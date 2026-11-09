const nodemailer = require('nodemailer');

/**
 * Create SMTP transporter using environment variables.
 * Supports standard SMTP (e.g. AWS SES, Mailgun, SendGrid) and Gmail SMTP.
 */
const createTransporter = () => {
  const host = process.env.SMTP_HOST || (process.env.SMTP_USER?.includes('@gmail.com') ? 'smtp.gmail.com' : null);
  const port = parseInt(process.env.SMTP_PORT, 10) || (host === 'smtp.gmail.com' ? 465 : 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  const isSecure = port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure: isSecure,
    auth: {
      user,
      pass
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production'
    }
  });
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
    // Graceful simulation when SMTP is not configured in local development
    console.log('\n==================================================');
    console.log('[EMAIL SERVICE - SIMULATED DELIVERY]');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Reset URL: ${resetUrl}`);
    console.log('NOTE: Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env to deliver live emails.');
    console.log('==================================================\n');
    return {
      success: true,
      simulated: true,
      messageId: `simulated_${Date.now()}`,
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
      error: err.message,
      resetUrl
    };
  }
};

module.exports = {
  sendPasswordResetEmail,
  createTransporter
};

