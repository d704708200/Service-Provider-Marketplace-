import { Platform } from 'react-native';

/**
 * Opens Razorpay payment checkout for settling platform commission.
 * Compatible with mobile native RazorpayCheckout and web checkout.
 */
export const openCommissionPaymentCheckout = async ({
  orderData,
  providerName = 'Provider',
  providerPhone = '',
  providerEmail = '',
  themeColor = '#7C3AED'
}) => {
  const rawKeyId = orderData?.keyId;
  const sanitizedKeyId = typeof rawKeyId === 'string' ? rawKeyId.trim() : '';

  if (!orderData?.orderId || !sanitizedKeyId) {
    throw new Error('Invalid order: orderId and keyId are required');
  }

  // --- NATIVE MOBILE CHECKOUT (Android / iOS) ---
  if (Platform.OS !== 'web') {
    let RazorpayCheckout;
    try {
      RazorpayCheckout = require('react-native-razorpay').default;
    } catch (importErr) {
      console.warn('Native Razorpay module not loaded, fallback or error:', importErr.message);
      throw new Error('Native payment gateway module not available. Please test on native device or web.');
    }

    const options = {
      description: 'Commission Payable to Mendroo',
      image: 'https://cdn.razorpay.com/static/assets/logo/rzp.png',
      currency: orderData.currency || 'INR',
      key: sanitizedKeyId,
      amount: orderData.amountInPaise,
      name: 'Mendroo Platform',
      order_id: orderData.orderId,
      prefill: {
        email: providerEmail || '',
        contact: providerPhone || '',
        name: providerName || 'Provider'
      },
      theme: {
        color: themeColor
      }
    };

    try {
      const response = await RazorpayCheckout.open(options);
      return {
        success: true,
        data: {
          razorpayOrderId: response.razorpay_order_id || orderData.orderId,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature
        }
      };
    } catch (error) {
      const isCancelled =
        error?.code === 0 ||
        error?.code === '0' ||
        /cancelled|canceled|closed|dismissed/i.test(error?.description || '');

      return {
        success: false,
        isCancelled,
        error: isCancelled ? 'Payment cancelled by user' : (error?.description || error?.message || 'Payment failed')
      };
    }
  }

  // --- WEB CHECKOUT FALLBACK ---
  return new Promise((resolve) => {
    const loadScript = () => {
      if (window.Razorpay) return Promise.resolve(true);
      return new Promise((res) => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => res(true);
        script.onerror = () => res(false);
        document.body.appendChild(script);
      });
    };

    loadScript().then((loaded) => {
      if (!loaded || !window.Razorpay) {
        return resolve({
          success: false,
          error: 'Failed to load Razorpay SDK in web environment'
        });
      }

      const rzp = new window.Razorpay({
        key: sanitizedKeyId,
        amount: orderData.amountInPaise,
        currency: orderData.currency || 'INR',
        name: 'Mendroo Platform',
        description: 'Commission Payable to Mendroo',
        order_id: orderData.orderId,
        prefill: {
          name: providerName,
          email: providerEmail,
          contact: providerPhone
        },
        theme: {
          color: themeColor
        },
        handler: (response) => {
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
          ondismiss: () => {
            resolve({
              success: false,
              isCancelled: true,
              error: 'Payment window was closed before completion'
            });
          }
        }
      });

      rzp.open();
    });
  });
};

