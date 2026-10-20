import { Platform } from 'react-native';

/**
 * Loads Razorpay script on web dynamically if not already loaded.
 */
export const loadRazorpayWebScript = () => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

/**
 * Universal Razorpay Checkout Launcher
 * Supports native Android/iOS via react-native-razorpay and Web via Razorpay Checkout script.
 *
 * @param {Object} params
 * @param {Object} params.orderData - Server response from /payment/order (orderId, amount, currency, keyId, etc.)
 * @param {string} [params.description] - Payment description
 * @param {string} [params.customerName] - Customer display name
 * @param {string} [params.customerPhone] - Customer phone number
 * @param {string} [params.customerEmail] - Customer email
 * @param {string} [params.themeColor] - Primary theme color hex
 * @returns {Promise<{
 *   success: boolean,
 *   data?: { razorpayOrderId: string, razorpayPaymentId: string, razorpaySignature: string },
 *   error?: { code?: number|string, description?: string, reason?: string, isCancelled?: boolean }
 * }>}
 */
export const openRazorpayCheckout = async ({
  orderData,
  description = 'Service Booking Payment',
  customerName = 'Customer',
  customerPhone = '',
  customerEmail = '',
  themeColor = '#7C3AED'
}) => {
  const rawKeyId = orderData?.keyId;
  const sanitizedKeyId = typeof rawKeyId === 'string' ? rawKeyId.trim() : '';

  if (!orderData?.orderId || !sanitizedKeyId) {
    throw new Error('Invalid Razorpay order data: orderId and keyId are required');
  }

  // Reject malformed key format (must be rzp_test_... or rzp_live_...)
  if (!/^rzp_(test|live)_[A-Za-z0-9]+$/.test(sanitizedKeyId)) {
    throw new Error(`Malformed Razorpay Key ID received: "${sanitizedKeyId}". Payment cannot proceed.`);
  }

  // --- NATIVE MOBILE CHECKOUT (Android / iOS) ---
  if (Platform.OS !== 'web') {
    let RazorpayCheckout;
    try {
      RazorpayCheckout = require('react-native-razorpay').default;
    } catch (importErr) {
      console.error('Failed to import react-native-razorpay:', importErr);
      throw new Error('Native Razorpay module is not linked. Please build and run the native APK.');
    }

    const options = {
      description,
      image: 'https://cdn.razorpay.com/static/assets/logo/rzp.png',
      currency: orderData.currency || 'INR',
      key: sanitizedKeyId,
      amount: orderData.amount, // in paise
      name: 'Service Marketplace',
      order_id: orderData.orderId,
      prefill: {
        email: customerEmail || '',
        contact: customerPhone || orderData.customer?.phone || '',
        name: customerName || orderData.customer?.name || 'Customer'
      },
      theme: {
        color: themeColor
      }
    };

    try {
      const response = await RazorpayCheckout.open(options);
      // Native response structure:
      // { razorpay_payment_id: "...", razorpay_order_id: "...", razorpay_signature: "..." }
      return {
        success: true,
        data: {
          razorpayOrderId: response.razorpay_order_id || orderData.orderId,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature
        }
      };
    } catch (error) {
      // RazorpayCheckout native rejection structure:
      // error.code (e.g. 0 for cancelled, 2 for network error)
      // error.description
      const isCancelled =
        error?.code === 0 ||
        error?.code === '0' ||
        /cancelled|canceled|closed|dismissed/i.test(error?.description || '');

      return {
        success: false,
        error: {
          code: error?.code,
          description: error?.description || (isCancelled ? 'Payment cancelled by user' : 'Payment failed'),
          reason: error?.reason || (isCancelled ? 'user_cancelled' : 'gateway_error'),
          isCancelled
        }
      };
    }
  }

  // --- WEB CHECKOUT FALLBACK ---
  const scriptLoaded = await loadRazorpayWebScript();
  if (!scriptLoaded || typeof window === 'undefined' || typeof window.Razorpay === 'undefined') {
    throw new Error('Could not initialize Razorpay checkout script on web.');
  }

  return new Promise((resolve) => {
    let settled = false;

    const webOptions = {
      key: sanitizedKeyId,
      amount: orderData.amount,
      currency: orderData.currency || 'INR',
      name: 'Service Marketplace',
      description,
      order_id: orderData.orderId,
      prefill: {
        name: customerName || orderData.customer?.name || 'Customer',
        contact: customerPhone || orderData.customer?.phone || '',
        email: customerEmail || ''
      },
      theme: {
        color: themeColor
      },
      handler: function (response) {
        if (settled) return;
        settled = true;
        resolve({
          success: true,
          data: {
            razorpayOrderId: response.razorpay_order_id || orderData.orderId,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature
          }
        });
      },
      modal: {
        ondismiss: function () {
          if (settled) return;
          settled = true;
          resolve({
            success: false,
            error: {
              code: 0,
              description: 'Customer closed payment window',
              reason: 'user_cancelled',
              isCancelled: true
            }
          });
        }
      }
    };

    let rzp;
    try {
      rzp = new window.Razorpay(webOptions);
      rzp.on('payment.failed', function (resp) {
        if (settled) return;
        settled = true;
        resolve({
          success: false,
          error: {
            code: resp?.error?.code,
            description: resp?.error?.description || 'Payment failed at gateway',
            reason: resp?.error?.reason || 'payment_failed',
            isCancelled: false
          }
        });
      });
      rzp.open();
    } catch (err) {
      if (settled) return;
      settled = true;
      resolve({
        success: false,
        error: {
          description: err?.message || 'Failed to open web checkout modal',
          isCancelled: false
        }
      });
    }
  });
};
