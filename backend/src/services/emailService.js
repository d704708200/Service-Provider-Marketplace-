const nodemailer = require('nodemailer');
const crypto = require('crypto');

/**
 * Determine the active email provider based on environment configuration.
 * Prioritizes 'google-apps-script' when configured on Render to bypass outbound SMTP port blocks.
 */
const getActiveProvider = () => {
  const envProvider = (process.env.EMAIL_PROVIDER || '').trim().toLowerCase();

  if (envProvider === 'google-apps-script' || envProvider === 'appsscript' || envProvider === 'apps-script') {
    return 'google-apps-script';
  }

  if (envProvider === 'brevo') {
    return 'brevo';
  }

  if (envProvider === 'smtp' || envProvider === 'gmail') {
    return 'smtp';
  }

  // Fallback auto-detection if EMAIL_PROVIDER is not explicitly set:
  if (process.env.GOOGLE_APPS_SCRIPT_URL && process.env.GOOGLE_APPS_SCRIPT_SECRET) {
    return 'google-apps-script';
  }

  if (process.env.BREVO_API_KEY) {
    return 'brevo';
  }

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    return 'smtp';
  }

  return 'none';
};

/**
 * Check if the active email provider is properly configured
 */
const isConfigured = () => {
  const provider = getActiveProvider();
  if (provider === 'google-apps-script') {
    return Boolean(process.env.GOOGLE_APPS_SCRIPT_URL && process.env.GOOGLE_APPS_SCRIPT_SECRET);
  }
  if (provider === 'smtp') {
    return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
  }
  if (provider === 'brevo') {
    return Boolean(process.env.BREVO_API_KEY);
  }
  return false;
};

/**
 * Send email via Google Apps Script Web App Relay.
 * Handles ContentService 302 redirects automatically and parses JSON output.
 */
const sendViaAppsScript = async ({ to, subject, htmlBody, textBody, senderName }) => {
  const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
  const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET;

  if (!scriptUrl || !secret) {
    return {
      success: false,
      provider: 'google-apps-script',
      configured: false,
      error: 'Google Apps Script configuration missing: GOOGLE_APPS_SCRIPT_URL or GOOGLE_APPS_SCRIPT_SECRET is unset.'
    };
  }

  // Unique requestId between 16 and 100 characters (e.g. 41 chars)
  const requestId = `req_${Date.now()}_${crypto.randomBytes(12).toString('hex')}`;

  const payload = {
    action: 'sendEmail',
    secret,
    to,
    subject,
    htmlBody,
    textBody,
    requestId,
    senderName: senderName || process.env.EMAIL_SENDER_NAME || 'Mendroo Marketplace'
  };

  try {
    let response = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });

    // Fallback: If 302/301 redirect wasn't followed automatically
    if ((response.status === 301 || response.status === 302 || response.status === 307) && response.headers.get('location')) {
      const redirectUrl = response.headers.get('location');
      response = await fetch(redirectUrl, {
        method: 'GET',
        redirect: 'follow'
      });
    }

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseErr) {
      return {
        success: false,
        provider: 'google-apps-script',
        configured: true,
        simulated: false,
        error: `Invalid response format from Apps Script (HTTP ${response.status}): ${text.slice(0, 200)}`,
        requestId
      };
    }

    if (data.success === true) {
      console.log(`[EMAIL SERVICE] Email successfully delivered to ${to} via Google Apps Script (Request ID: ${requestId})`);
      return {
        success: true,
        provider: 'google-apps-script',
        configured: true,
        simulated: false,
        messageId: data.messageId || requestId,
        requestId,
        recipient: to,
        response: data
      };
    }

    console.error(`[EMAIL SERVICE ERROR] Google Apps Script rejected email to ${to}:`, data.error || data.message || 'Unknown error');
    return {
      success: false,
      provider: 'google-apps-script',
      configured: true,
      simulated: false,
      error: data.error || data.message || 'Apps Script returned success=false',
      requestId,
      response: data
    };
  } catch (err) {
    console.error(`[EMAIL SERVICE ERROR] Failed to connect to Google Apps Script relay:`, err.message);
    return {
      success: false,
      provider: 'google-apps-script',
      configured: true,
      simulated: false,
      error: err.message,
      requestId
    };
  }
};

/**
 * Create SMTP transporter using environment variables.
 * Configured for Gmail SMTP on port 587 with STARTTLS by default.
 */
const createTransporter = () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  const isSecure = port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure: isSecure,
    requireTLS: port === 587,
    auth: {
      user,
      pass
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production'
    }
  });
};

/**
 * Verify email provider connection and authentication
 */
const verifyEmailProvider = async () => {
  const provider = getActiveProvider();

  if (provider === 'google-apps-script') {
    const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
    const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET;

    if (!scriptUrl || !secret) {
      return {
        success: false,
        provider: 'google-apps-script',
        configured: false,
        error: 'GOOGLE_APPS_SCRIPT_URL or GOOGLE_APPS_SCRIPT_SECRET is missing.'
      };
    }

    // Ping or verify connection to Apps Script Web App
    const requestId = `ping_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    try {
      let response = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ping',
          secret,
          requestId
        }),
        redirect: 'follow'
      });

      if ((response.status === 301 || response.status === 302 || response.status === 307) && response.headers.get('location')) {
        response = await fetch(response.headers.get('location'), {
          method: 'GET',
          redirect: 'follow'
        });
      }

      const text = await response.text();
      let data = {};
      try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }

      // If ping returns success=true or endpoint responded with valid HTTP status
      const isOk = response.status >= 200 && response.status < 400 && data.success !== false;

      return {
        success: isOk,
        provider: 'google-apps-script',
        configured: true,
        status: response.status,
        data: data.success !== undefined ? { success: data.success, message: data.message || 'Relay reachable' } : { reachable: true }
      };
    } catch (err) {
      return {
        success: false,
        provider: 'google-apps-script',
        configured: true,
        error: err.message
      };
    }
  }

  if (provider === 'smtp') {
    const transporter = createTransporter();
    if (!transporter) {
      return {
        success: false,
        provider: 'smtp',
        configured: false,
        error: 'SMTP credentials missing: SMTP_USER and/or SMTP_PASS are not configured.'
      };
    }

    try {
      await transporter.verify();
      return {
        success: true,
        provider: 'smtp',
        configured: true,
        host: transporter.options.host,
        port: transporter.options.port,
        secure: transporter.options.secure,
        requireTLS: transporter.options.requireTLS
      };
    } catch (err) {
      return {
        success: false,
        provider: 'smtp',
        configured: true,
        host: transporter.options.host,
        port: transporter.options.port,
        error: err.message
      };
    }
  }

  return {
    success: false,
    provider: 'none',
    configured: false,
    error: 'No email provider configured in environment.'
  };
};

/**
 * Send Password Reset Email using the active provider
 */
const sendPasswordResetEmail = async ({ to, name, resetUrl, expiresInMinutes = 15 }) => {
  const subject = 'Reset Your Mendroo Account Password';

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0B0B0E;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #E2E8F0;
    }
    .wrapper {
      width: 100%;
      background-color: #0B0B0E;
      padding: 40px 15px;
      box-sizing: border-box;
    }
    .card {
      max-width: 540px;
      margin: 0 auto;
      background-color: #161424;
      border: 1px solid #28233D;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    }
    .header {
      background: linear-gradient(135deg, #1E1B4B 0%, #2E1065 100%);
      padding: 30px 24px;
      text-align: center;
      border-bottom: 1px solid #3B2E68;
    }
    .brand {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #FFFFFF;
      text-transform: uppercase;
    }
    .brand-accent {
      color: #A78BFA;
    }
    .content {
      padding: 32px 28px;
    }
    .greeting {
      font-size: 18px;
      font-weight: 700;
      color: #FFFFFF;
      margin-bottom: 12px;
    }
    .message {
      font-size: 14px;
      line-height: 22px;
      color: #CBD5E1;
      margin-bottom: 24px;
    }
    .btn-container {
      text-align: center;
      margin: 32px 0;
    }
    .btn {
      display: inline-block;
      background-color: #7C3AED;
      color: #FFFFFF !important;
      font-size: 15px;
      font-weight: 700;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 8px;
      box-shadow: 0 4px 14px rgba(124, 58, 237, 0.4);
    }
    .expiry-box {
      background-color: #1E1B2E;
      border-left: 4px solid #F59E0B;
      padding: 12px 16px;
      border-radius: 4px;
      margin-bottom: 24px;
      font-size: 13px;
      color: #FBBF24;
    }
    .alt-link {
      font-size: 12px;
      line-height: 18px;
      color: #94A3B8;
      word-break: break-all;
      background-color: #0F0E17;
      padding: 12px;
      border-radius: 6px;
      border: 1px solid #1F1C2B;
    }
    .footer {
      background-color: #0F0E17;
      padding: 20px 24px;
      border-top: 1px solid #201C30;
      text-align: center;
      font-size: 12px;
      line-height: 18px;
      color: #64748B;
    }
    .security-note {
      color: #EF4444;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="brand">MENDROO <span class="brand-accent">MARKETPLACE</span></div>
      </div>
      <div class="content">
        <div class="greeting">Hello ${name || 'User'},</div>
        <p class="message">
          We received a request to reset the password for your Mendroo account. Click the button below to choose a new, secure password:
        </p>
        <div class="btn-container">
          <a href="${resetUrl}" class="btn" target="_blank" rel="noopener noreferrer">Reset My Password</a>
        </div>
        <div class="expiry-box">
          ⚠️ <strong>This link is valid for ${expiresInMinutes} minutes only.</strong> After that, you will need to request a new password reset link.
        </div>
        <p class="message" style="margin-bottom: 8px;">
          If the button above does not work, copy and paste this link into your web browser:
        </p>
        <div class="alt-link">${resetUrl}</div>
      </div>
      <div class="footer">
        <p style="margin: 0 0 8px 0;">
          <span class="security-note">Did not request this change?</span> You can safely ignore this email. Your current password remains unchanged.
        </p>
        <p style="margin: 0;">
          &copy; ${new Date().getFullYear()} Mendroo Service Provider Marketplace. All rights reserved.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  const textContent = `
Hello ${name || 'User'},

We received a request to reset the password for your Mendroo Marketplace account.

Please use the link below to set a new password:
${resetUrl}

This link is valid for ${expiresInMinutes} minutes.

If you did not request this password reset, please ignore this email. Your password will not change until you access the link above and create a new one.

- The Mendroo Marketplace Team
  `.trim();

  const provider = getActiveProvider();

  if (provider === 'google-apps-script') {
    const result = await sendViaAppsScript({
      to,
      subject,
      htmlBody: htmlContent,
      textBody: textContent,
      senderName: 'Mendroo Marketplace'
    });

    return {
      ...result,
      resetUrl
    };
  }

  if (provider === 'smtp') {
    const transporter = createTransporter();
    if (!transporter) {
      console.warn('[EMAIL SERVICE] SMTP transporter not configured (SMTP_USER or SMTP_PASS missing). Email NOT sent.');
      return {
        success: false,
        provider: 'smtp',
        simulated: true,
        error: 'SMTP transporter not configured. Set SMTP_USER and SMTP_PASS in environment variables.',
        resetUrl
      };
    }

    try {
      const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || 'Mendroo Marketplace <no-reply@mendroo.com>';
      const info = await transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        text: textContent,
        html: htmlContent
      });

      console.log(`[EMAIL SERVICE] Password reset email sent to ${to} via SMTP (Message ID: ${info.messageId})`);
      return {
        success: true,
        provider: 'smtp',
        simulated: false,
        messageId: info.messageId,
        resetUrl
      };
    } catch (err) {
      console.error(`[EMAIL SERVICE ERROR] Failed to send email to ${to} via SMTP:`, err.message);
      return {
        success: false,
        provider: 'smtp',
        simulated: false,
        error: err.message,
        resetUrl
      };
    }
  }

  console.warn('[EMAIL SERVICE] No active email provider configured (EMAIL_PROVIDER unset or missing credentials). Email NOT sent.');
  return {
    success: false,
    provider: 'none',
    simulated: true,
    error: 'No email provider configured. Set EMAIL_PROVIDER=google-apps-script with GOOGLE_APPS_SCRIPT_URL and GOOGLE_APPS_SCRIPT_SECRET.',
    resetUrl
  };
};

/**
 * Send one genuine test email to an authorized test mailbox
 */
const sendTestEmail = async ({ to }) => {
  const provider = getActiveProvider();
  const subject = 'Mendroo Marketplace - Email Relay Verification';
  const text = `This is a genuine verification email confirming that the Mendroo Marketplace email relay (${provider}) is operating properly.\n\nTimestamp: ${new Date().toISOString()}`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; background-color: #0B0B0E; color: #E2E8F0; border-radius: 12px; border: 1px solid #28233D; max-width: 500px;">
      <h2 style="color: #A78BFA; margin-top: 0;">Mendroo Marketplace - Email Verification</h2>
      <p style="font-size: 14px; line-height: 22px; color: #CBD5E1;">
        This is a genuine verification email confirming that the <strong>${provider}</strong> email relay is operating properly and delivering messages to recipient mailboxes.
      </p>
      <div style="background-color: #161424; padding: 12px 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #28233D; font-size: 13px;">
        <p style="margin: 4px 0;"><strong>Active Provider:</strong> ${provider}</p>
        <p style="margin: 4px 0;"><strong>Status:</strong> ✅ Genuine Live Delivery</p>
        <p style="margin: 4px 0;"><strong>Recipient:</strong> ${to}</p>
        <p style="margin: 4px 0;"><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
      </div>
      <p style="font-size: 12px; color: #64748B; margin-bottom: 0;">
        &copy; ${new Date().getFullYear()} Mendroo Service Provider Marketplace. All rights reserved.
      </p>
    </div>
  `.trim();

  if (provider === 'google-apps-script') {
    return await sendViaAppsScript({
      to,
      subject,
      htmlBody: html,
      textBody: text,
      senderName: 'Mendroo Marketplace'
    });
  }

  if (provider === 'smtp') {
    const transporter = createTransporter();
    if (!transporter) {
      return {
        success: false,
        provider: 'smtp',
        configured: false,
        simulated: true,
        error: 'SMTP credentials missing. Email NOT sent.'
      };
    }
    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || 'Mendroo Marketplace <no-reply@mendroo.com>';
    try {
      const info = await transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        text,
        html
      });
      return {
        success: true,
        provider: 'smtp',
        configured: true,
        simulated: false,
        messageId: info.messageId,
        recipient: to
      };
    } catch (err) {
      return {
        success: false,
        provider: 'smtp',
        configured: true,
        simulated: false,
        error: err.message
      };
    }
  }

  return {
    success: false,
    provider: 'none',
    configured: false,
    simulated: true,
    error: 'No email provider configured. Email NOT sent.'
  };
};

module.exports = {
  getActiveProvider,
  isConfigured,
  sendViaAppsScript,
  sendPasswordResetEmail,
  sendTestEmail,
  verifyEmailProvider,
  verifyTransporter: verifyEmailProvider,
  createTransporter
};
