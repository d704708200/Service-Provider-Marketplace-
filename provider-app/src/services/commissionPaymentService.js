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
        /cancelled|canceled|closed|dismissed/i.test(error?.description || error?.message || '');

      return {
        success: false,
        isCancelled,
        error: isCancelled ? 'Payment cancelled by user' : (error?.description || error?.message || 'Payment failed')
      };
    }
  }

  // --- WEB CHECKOUT FALLBACK ---
  return new Promise((resolve) => {
    let settled = false;

    const safeResolve = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const loadScript = () => {
      if (typeof window === 'undefined') return Promise.resolve(false);
      if (window.Razorpay) return Promise.resolve(true);

      return new Promise((res) => {
        const existing = document.querySelector('script[src*="checkout.razorpay.com"]');
        if (existing) {
          existing.addEventListener('load', () => res(true));
          existing.addEventListener('error', () => res(false));
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.onload = () => res(true);
        script.onerror = () => res(false);
        (document.head || document.body).appendChild(script);
      });
    };

    loadScript()
      .then((loaded) => {
        if (!loaded || !window.Razorpay) {
          return safeResolve({
            success: false,
            isCancelled: false,
            error: 'Failed to load Razorpay SDK in web environment. Please check your internet connection or ad blocker.'
          });
        }

        try {
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
              safeResolve({
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
                safeResolve({
                  success: false,
                  isCancelled: true,
                  error: 'Payment window was closed before completion'
                });
              }
            }
          });

          rzp.on('payment.failed', (resp) => {
            safeResolve({
              success: false,
              isCancelled: false,
              error: resp?.error?.description || resp?.error?.reason || 'Payment failed at gateway'
            });
          });

          rzp.open();
        } catch (launchErr) {
          safeResolve({
            success: false,
            isCancelled: false,
            error: launchErr?.message || 'Could not launch Razorpay checkout modal'
          });
        }
      })
      .catch((err) => {
        safeResolve({
          success: false,
          isCancelled: false,
          error: err?.message || 'Unexpected error initializing checkout'
        });
      });
  });
};
