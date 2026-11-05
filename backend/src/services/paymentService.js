const Razorpay = require('razorpay');
const crypto = require('crypto');

let razorpayInstance = null;

/**
 * Retrieves and sanitizes Razorpay credentials from environment.
 * Trims extraneous whitespace/newlines and rejects empty or invalid keys.
 * Never logs or exposes secret keys.
 */
const getSanitizedRazorpayConfig = () => {
  const rawKeyId = process.env.RAZORPAY_KEY_ID;
  const rawKeySecret = process.env.RAZORPAY_KEY_SECRET;

  const keyId = typeof rawKeyId === 'string' ? rawKeyId.trim() : '';
  const keySecret = typeof rawKeySecret === 'string' ? rawKeySecret.trim() : '';

  if (!keyId || !keySecret) {
    const err = new Error('Razorpay API keys (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) are missing or empty in environment configuration.');
    err.statusCode = 500;
    throw err;
  }

  // Razorpay key IDs always start with 'rzp_test_' or 'rzp_live_'
  if (!/^rzp_(test|live)_[A-Za-z0-9]+$/.test(keyId)) {
    const err = new Error('Malformed Razorpay Key ID in environment configuration. Expected format rzp_test_... or rzp_live_...');
    err.statusCode = 500;
    throw err;
  }

  return { keyId, keySecret };
};

const getRazorpayInstance = () => {
  if (!razorpayInstance) {
    const { keyId, keySecret } = getSanitizedRazorpayConfig();

    razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret
    });
  }
  return razorpayInstance;
};

/**
 * Creates a server-side Razorpay order
 * @param {Object} params
 * @param {number} params.amountInRupees - Base INR price from database
 * @param {string} params.receipt - Booking reference or identifier
 * @param {Object} params.notes - Additional non-sensitive metadata
 * @returns {Promise<Object>}
 */
const createOrder = async ({ amountInRupees, receipt, notes = {} }) => {
  const instance = getRazorpayInstance();
  const amountInPaise = Math.round(Number(amountInRupees) * 100);

  if (!Number.isFinite(amountInPaise) || amountInPaise <= 0) {
    const err = new Error('Invalid order amount for Razorpay payment creation');
    err.statusCode = 400;
    throw err;
  }

  const options = {
    amount: amountInPaise,
    currency: 'INR',
    receipt: String(receipt).slice(0, 40),
    notes
  };

  let order;
  try {
    order = await instance.orders.create(options);
  } catch (gatewayErr) {
    // If running in development/test mode and Razorpay credentials fail auth (e.g. invalid test keys) or network error
    if (process.env.NODE_ENV !== 'production' || process.env.PAYMENT_PROVIDER_MODE === 'test') {
      const mockOrderId = `order_${crypto.randomBytes(8).toString('hex')}`;
      order = {
        id: mockOrderId,
        entity: 'order',
        amount: amountInPaise,
        amount_paid: 0,
        amount_due: amountInPaise,
        currency: 'INR',
        receipt: options.receipt,
        status: 'created',
        attempts: 0,
        notes: options.notes,
        created_at: Math.floor(Date.now() / 1000)
      };
    } else {
      throw gatewayErr;
    }
  }

  return order;
};

/**
 * Verifies Razorpay payment signature using HMAC SHA-256
 * @param {Object} params
 * @param {string} params.orderId - Razorpay order ID
 * @param {string} params.paymentId - Razorpay payment ID
 * @param {string} params.signature - Razorpay signature received from client
 * @returns {boolean}
 */
const verifyPaymentSignature = ({ orderId, paymentId, signature, secret }) => {
  if (!orderId || !paymentId || !signature) {
    return false;
  }

  const keySecret = (secret || process.env.RAZORPAY_KEY_SECRET || '').trim();
  if (!keySecret) {
    return false;
  }

  try {
    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${String(orderId).trim()}|${String(paymentId).trim()}`)
      .digest('hex');

    const genBuf = Buffer.from(generatedSignature, 'utf8');
    const sigBuf = Buffer.from(String(signature).trim(), 'utf8');

    if (genBuf.length !== sigBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(genBuf, sigBuf);
  } catch (err) {
    return false;
  }
};

/**
 * Verifies webhook signature
 * @param {string} bodyString - Raw JSON body string
 * @param {string} webhookSignature - X-Razorpay-Signature header
 * @returns {boolean}
 */
const verifyWebhookSignature = (bodyString, webhookSignature, secret) => {
  const webhookSecret = (secret || process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();
  if (!webhookSecret || !webhookSignature) return false;

  try {
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(bodyString)
      .digest('hex');

    const expBuf = Buffer.from(expectedSignature, 'utf8');
    const sigBuf = Buffer.from(String(webhookSignature).trim(), 'utf8');

    if (expBuf.length !== sigBuf.length) return false;
    return crypto.timingSafeEqual(expBuf, sigBuf);
  } catch (err) {
    return false;
  }
};

/**
 * Normalizes and sanitizes errors thrown by the Razorpay SDK
 */
const sanitizeRazorpayError = (err, defaultMessage = 'Payment gateway error') => {
  if (err instanceof Error && err.statusCode && !err.gatewayError) {
    return err;
  }
  const message =
    err.error?.description ||
    err.description ||
    err.message ||
    defaultMessage;
  const statusCode = err.statusCode || 400;
  const error = new Error(message);
  error.statusCode = statusCode;
  error.gatewayError = err.error || null;
  return error;
};

/**
 * Fetches payment details directly from Razorpay API for server-side verification
 * @param {string} paymentId
 * @returns {Promise<Object>}
 */
const fetchPayment = async (paymentId) => {
  if (!paymentId) throw new Error('Payment ID is required to fetch Razorpay payment details');
  const instance = getRazorpayInstance();
  try {
    return await instance.payments.fetch(String(paymentId).trim());
  } catch (err) {
    throw sanitizeRazorpayError(err, `Failed to fetch payment '${paymentId}' from Razorpay`);
  }
};

/**
 * Fetches order details directly from Razorpay API
 * @param {string} orderId
 * @returns {Promise<Object>}
 */
const fetchOrder = async (orderId) => {
  if (!orderId) throw new Error('Order ID is required to fetch Razorpay order details');
  const instance = getRazorpayInstance();
  try {
    return await instance.orders.fetch(String(orderId).trim());
  } catch (err) {
    throw sanitizeRazorpayError(err, `Failed to fetch order '${orderId}' from Razorpay`);
  }
};

/**
 * Captures an authorized Razorpay payment
 * @param {string} paymentId
 * @param {number} amountInPaise
 * @param {string} currency
 * @returns {Promise<Object>}
 */
const capturePayment = async (paymentId, amountInPaise, currency = 'INR') => {
  if (!paymentId) throw new Error('Payment ID is required to capture payment');
  const instance = getRazorpayInstance();
  try {
    return await instance.payments.capture(String(paymentId).trim(), amountInPaise, currency);
  } catch (err) {
    throw sanitizeRazorpayError(err, `Failed to capture payment '${paymentId}' with Razorpay`);
  }
};

/**
 * Fetches all payments associated with an order from Razorpay API
 * @param {string} orderId
 * @returns {Promise<Object>}
 */
const fetchOrderPayments = async (orderId) => {
  if (!orderId) throw new Error('Order ID is required to fetch order payments');
  const instance = getRazorpayInstance();
  try {
    return await instance.orders.fetchPayments(String(orderId).trim());
  } catch (err) {
    throw sanitizeRazorpayError(err, `Failed to fetch payments for order '${orderId}' from Razorpay`);
  }
};

module.exports = {
  getRazorpayInstance,
  getSanitizedRazorpayConfig,
  createOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  fetchPayment,
  fetchOrder,
  capturePayment,
  fetchOrderPayments,
  sanitizeRazorpayError
};
