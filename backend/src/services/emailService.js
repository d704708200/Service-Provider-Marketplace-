const nodemailer = require('nodemailer');

/**
 * Create SMTP transporter using environment variables.
 * Configured for Gmail SMTP on port 587 with STARTTLS by default.
 */
const createTransporter = () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  // Use port 587 with STARTTLS by default for Gmail SMTP
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
    secure: isSecure, // false for port 587
    requireTLS: port === 587, // explicitly enforce STARTTLS on port 587
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
 * Run SMTP transporter verification to test connection & auth handshake
 */
const verifyTransporter = async () => {
  const transporter = createTransporter();
  if (!transporter) {
    return {
      success: false,
      configured: false,
      error: 'SMTP credentials missing: SMTP_USER and/or SMTP_PASS are not configured in environment.'
    };
  }

  try {
    await transporter.verify();
    return {
      success: true,
      configured: true,
      host: transporter.options.host,
      port: transporter.options.port,
      secure: transporter.options.secure,
      requireTLS: transporter.options.requireTLS
    };
  } catch (err) {
    return {
      success: false,
      configured: true,
      host: transporter.options.host,
      port: transporter.options.port,
      error: err.message
    };
  }
};

/**
 * Send one genuine test email to an authorized test mailbox
 */
const sendTestEmail = async ({ to }) => {
  const transporter = createTransporter();
  if (!transporter) {
    return {
      success: false,
      configured: false,
      simulated: true,
      error: 'SMTP credentials missing. Email NOT sent.'
    };
  }

  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || 'Mendroo Marketplace <no-reply@mendroo.com>';
  const subject = 'Mendroo Marketplace - Gmail SMTP Integration Verification';
  const text = `This is a genuine verification email from Mendroo Marketplace confirming Gmail SMTP integration on port 587 with STARTTLS.\n\nTimestamp: ${new Date().toISOString()}`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; background-color: #0B0B0E; color: #E2E8F0; border-radius: 12px; border: 1px solid #28233D; max-width: 500px;">
      <h2 style="color: #A78BFA; margin-top: 0;">Mendroo Marketplace - SMTP Verification</h2>
      <p style="font-size: 14px; line-height: 22px; color: #CBD5E1;">
        This is a genuine verification email confirming that Gmail SMTP is operating properly on <strong>smtp.gmail.com:587</strong> with <strong>STARTTLS</strong>.
      </p>
      <div style="background-color: #161424; padding: 12px 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #28233D; font-size: 13px;">
        <p style="margin: 4px 0;"><strong>Status:</strong> ✅ Verified Connected</p>
        <p style="margin: 4px 0;"><strong>Server:</strong> smtp.gmail.com:587 (STARTTLS)</p>
        <p style="margin: 4px 0;"><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
      </div>
      <p style="font-size: 12px; color: #64748B; margin-bottom: 0;">
        &copy; ${new Date().getFullYear()} Mendroo Service Provider Marketplace. All rights reserved.
      </p>
    </div>
  `.trim();

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      text,
      html
    });

    console.log(`[EMAIL SERVICE] Test verification email sent to ${to} (Message ID: ${info.messageId})`);
    return {
      success: true,
      configured: true,
      simulated: false,
      messageId: info.messageId,
      recipient: to
    };
  } catch (err) {
    console.error(`[EMAIL SERVICE ERROR] Test email delivery failed to ${to}:`, err.message);
    return {
      success: false,
      configured: true,
      simulated: false,
      error: err.message
    };
  }
};

/**
 * Send Password Reset Email
 * 
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.name - Recipient user name
 * @param {string} options.resetUrl - Password reset action link
 * @param {number} options.expiresInMinutes - Expiration time in minutes (default 15)
 */
const sendPasswordResetEmail = async ({ to, name, resetUrl, expiresInMinutes = 15 }) => {
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || 'Mendroo Marketplace <no-reply@mendroo.com>';
  const transporter = createTransporter();

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

  if (!transporter) {
    // When SMTP is not configured in local development, record notice without reporting false success
    console.warn('[EMAIL SERVICE] SMTP transporter not configured (SMTP_USER or SMTP_PASS missing). Email NOT sent.');
    return {
      success: false,
      simulated: true,
      error: 'SMTP transporter not configured. Set SMTP_USER and SMTP_PASS in environment variables.',
      resetUrl
    };
  }

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      text: textContent,
      html: htmlContent
    });

    console.log(`[EMAIL SERVICE] Password reset email sent to ${to} (Message ID: ${info.messageId})`);
    return {
      success: true,
      simulated: false,
      messageId: info.messageId,
      resetUrl
    };
  } catch (err) {
    console.error(`[EMAIL SERVICE ERROR] Failed to send email to ${to}:`, err.message);
    // Return error without crashing callers
    return {
      success: false,
      simulated: false,
      error: err.message,
      resetUrl
    };
  }
};

module.exports = {
  sendPasswordResetEmail,
  createTransporter,
  verifyTransporter,
  sendTestEmail
};

