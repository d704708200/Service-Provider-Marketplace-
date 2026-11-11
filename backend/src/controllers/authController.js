const crypto = require('crypto');
const authService = require('../services/authService');
const emailService = require('../services/emailService');

const registerCustomer = async (req, res, next) => {
  try {
    const result = await authService.registerCustomer(req.body);
    res.status(201).json({
      success: true,
      message: 'Customer registered successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const loginCustomer = async (req, res, next) => {
  try {
    const result = await authService.loginCustomer(req.body);
    res.status(200).json({
      success: true,
      message: 'Customer logged in successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const registerProvider = async (req, res, next) => {
  try {
    const result = await authService.registerProvider(req.body);
    res.status(201).json({
      success: true,
      message: 'Provider registered successfully. Account is pending admin verification.',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const loginProvider = async (req, res, next) => {
  try {
    const result = await authService.loginProvider(req.body);
    res.status(200).json({
      success: true,
      message: 'Provider logged in successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const loginAdmin = async (req, res, next) => {
  try {
    const result = await authService.loginAdmin(req.body);
    res.status(200).json({
      success: true,
      message: 'Administrator authenticated successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    const result = await authService.getCurrentUser(req.user._id);
    res.status(200).json({
      success: true,
      message: 'Current user profile retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const origin = req.get('origin') || `${req.protocol}://${req.get('host')}`;
    const isAdminTest = Boolean(
      process.env.GOOGLE_APPS_SCRIPT_SECRET &&
      req.headers['x-admin-secret'] &&
      req.headers['x-admin-secret'] === process.env.GOOGLE_APPS_SCRIPT_SECRET
    );
    const result = await authService.forgotPassword({
      email: req.body.email,
      origin,
      isAdminTest
    });
    res.status(200).json({
      success: true,
      message: result.message,
      ...(isAdminTest && result.testResetUrl ? { testResetUrl: result.testResetUrl, deliveryStatus: result.deliveryStatus } : {})
    });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  const isHtmlSubmission = Boolean(
    req.headers.accept &&
    req.headers.accept.includes('text/html') &&
    !req.xhr &&
    !req.is('json')
  );

  try {
    const result = await authService.resetPassword({
      token: req.body.token,
      newPassword: req.body.newPassword,
      confirmPassword: req.body.confirmPassword
    });

    if (isHtmlSubmission) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.status(200).send(renderSuccessHtml(result.message));
    }

    res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    if (isHtmlSubmission) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.status(error.statusCode || 400).send(renderErrorHtml(error.message, req.body.token));
    }
    next(error);
  }
};

const renderSuccessHtml = (message) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <title>Password Reset Successful - Mendroo Marketplace</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='20' fill='%237C3AED'/%3E%3Ctext x='50%25' y='65%25' font-size='56' font-weight='800' fill='white' text-anchor='middle' font-family='system-ui, sans-serif'%3EM%3C/text%3E%3C/svg%3E">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #0B0B0E;
      color: #E2E8F0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      width: 100%;
      max-width: 460px;
      background: #161424;
      border: 1px solid #28233D;
      border-radius: 16px;
      padding: 36px 28px;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    }
    .icon { font-size: 48px; margin-bottom: 16px; }
    .brand { font-size: 24px; font-weight: 800; color: #FFFFFF; text-transform: uppercase; margin-bottom: 6px; }
    .brand span { color: #8B5CF6; }
    h1 { font-size: 20px; font-weight: 700; color: #10B981; margin-bottom: 12px; }
    p { font-size: 14px; color: #CBD5E1; line-height: 1.6; margin-bottom: 24px; }
    .footer { font-size: 12px; color: #64748B; border-top: 1px solid #28233D; padding-top: 18px; margin-top: 18px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="brand">Mend<span>roo</span> Marketplace</div>
    <div class="icon">✅</div>
    <h1>Password Reset Successful</h1>
    <p>${message || 'Your password has been reset successfully. You can now return to the Mendroo Customer or Provider App to log in.'}</p>
    <div class="footer">&copy; ${new Date().getFullYear()} Mendroo Service Provider Marketplace. All rights reserved.</div>
  </div>
</body>
</html>`;

const renderErrorHtml = (errorMessage, token) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <title>Reset Failed - Mendroo Marketplace</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='20' fill='%237C3AED'/%3E%3Ctext x='50%25' y='65%25' font-size='56' font-weight='800' fill='white' text-anchor='middle' font-family='system-ui, sans-serif'%3EM%3C/text%3E%3C/svg%3E">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #0B0B0E;
      color: #E2E8F0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      width: 100%;
      max-width: 460px;
      background: #161424;
      border: 1px solid #28233D;
      border-radius: 16px;
      padding: 36px 28px;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    }
    .icon { font-size: 48px; margin-bottom: 16px; }
    .brand { font-size: 24px; font-weight: 800; color: #FFFFFF; text-transform: uppercase; margin-bottom: 6px; }
    .brand span { color: #8B5CF6; }
    h1 { font-size: 20px; font-weight: 700; color: #EF4444; margin-bottom: 12px; }
    p { font-size: 14px; color: #CBD5E1; line-height: 1.6; margin-bottom: 24px; }
    .btn {
      display: inline-block;
      background: #7C3AED;
      color: #FFFFFF;
      padding: 12px 24px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
    }
    .footer { font-size: 12px; color: #64748B; border-top: 1px solid #28233D; padding-top: 18px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="brand">Mend<span>roo</span> Marketplace</div>
    <div class="icon">⚠️</div>
    <h1>Password Reset Failed</h1>
    <p>${errorMessage || 'The reset link may have expired or was already used. Please request a new reset email from the app.'}</p>
    <a href="/api/auth/reset-password?token=${token || ''}" class="btn">Try Again</a>
    <div class="footer">&copy; ${new Date().getFullYear()} Mendroo Service Provider Marketplace. All rights reserved.</div>
  </div>
</body>
</html>`;

const renderResetPasswordPage = async (req, res) => {
  const nonce = crypto.randomBytes(16).toString('base64');
  const safeToken = (req.query.token || '').toString().replace(/[^a-zA-Z0-9]/g, '');

  let accountEmail = '';
  let tokenInvalidOrExpired = false;

  if (safeToken && safeToken.length >= 32) {
    try {
      const hashedToken = crypto.createHash('sha256').update(safeToken).digest('hex');
      const User = require('../models/User');
      const matchedUser = await User.findOne({
        passwordResetToken: hashedToken,
        isDeleted: { $ne: true }
      }).select('+passwordResetToken +passwordResetExpires');

      if (matchedUser) {
        if (!matchedUser.passwordResetExpires || matchedUser.passwordResetExpires.getTime() < Date.now()) {
          tokenInvalidOrExpired = true;
        } else {
          accountEmail = matchedUser.email;
        }
      } else {
        tokenInvalidOrExpired = true;
      }
    } catch (err) {
      // Fallback gracefully on DB lookup issue
    }
  } else if (safeToken) {
    tokenInvalidOrExpired = true;
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader(
    'Content-Security-Policy',
    `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; font-src 'self' https: data:; form-action 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'; upgrade-insecure-requests`
  );
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  const gVerification = process.env.GOOGLE_SITE_VERIFICATION ? `<meta name="google-site-verification" content="${process.env.GOOGLE_SITE_VERIFICATION}">` : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Official password recovery portal for Mendroo Service Provider Marketplace. Securely choose a new password for your customer or provider account.">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <meta name="theme-color" content="#7C3AED">
  <meta name="application-name" content="Mendroo Marketplace">
  ${gVerification}
  <link rel="canonical" href="https://service-provider-marketplace.onrender.com/reset-password">
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='20' fill='%237C3AED'/%3E%3Ctext x='50%25' y='65%25' font-size='56' font-weight='800' fill='white' text-anchor='middle' font-family='system-ui, sans-serif'%3EM%3C/text%3E%3C/svg%3E">
  <title>Reset Password - Mendroo Service Provider Marketplace</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #0B0B0E;
      color: #E2E8F0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
    }
    .container {
      width: 100%;
      max-width: 460px;
      background: #161424;
      border: 1px solid #28233D;
      border-radius: 16px;
      padding: 36px 28px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    }
    .header {
      text-align: center;
      margin-bottom: 24px;
    }
    .brand {
      font-size: 24px;
      font-weight: 800;
      color: #FFFFFF;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .brand span {
      color: #8B5CF6;
    }
    .brand-sub {
      color: #94A3B8;
      font-size: 15px;
      font-weight: 600;
    }
    .official-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(124, 58, 237, 0.15);
      border: 1px solid rgba(124, 58, 237, 0.35);
      color: #C4B5FD;
      font-size: 11px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 20px;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .title {
      font-size: 20px;
      font-weight: 700;
      color: #F8FAFC;
      margin-bottom: 6px;
    }
    .subtitle {
      font-size: 13px;
      color: #94A3B8;
      line-height: 1.5;
    }
    .security-notice {
      background: #12101F;
      border-left: 3px solid #8B5CF6;
      padding: 10px 14px;
      border-radius: 6px;
      margin-bottom: 22px;
      font-size: 12px;
      color: #CBD5E1;
      line-height: 1.4;
    }
    .security-notice code {
      color: #A78BFA;
      font-family: SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 11px;
      word-break: break-all;
    }
    .form-group {
      margin-bottom: 18px;
    }
    label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #CBD5E1;
      margin-bottom: 6px;
    }
    .input-wrapper {
      position: relative;
    }
    input[type="password"],
    input[type="text"] {
      width: 100%;
      background: #0D0C17;
      border: 1px solid #2A2542;
      border-radius: 10px;
      padding: 13px 16px;
      font-size: 15px;
      color: #FFFFFF;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    input:focus {
      border-color: #8B5CF6;
      box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.2);
    }
    .btn {
      width: 100%;
      background: linear-gradient(135deg, #7C3AED 0%, #6366F1 100%);
      color: #FFFFFF;
      border: none;
      border-radius: 10px;
      padding: 14px;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(124, 58, 237, 0.35);
      transition: opacity 0.2s, transform 0.1s;
    }
    .btn:hover:not(:disabled) {
      opacity: 0.95;
      transform: translateY(-1px);
    }
    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .alert {
      padding: 12px 14px;
      border-radius: 8px;
      font-size: 13px;
      line-height: 1.4;
      margin-bottom: 20px;
      display: none;
    }
    .alert-error {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: #FCA5A5;
    }
    .alert-success {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #6EE7B7;
    }
    .show-password-container {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
      font-size: 12px;
      color: #94A3B8;
      cursor: pointer;
    }
    .show-password-container input {
      cursor: pointer;
      accent-color: #8B5CF6;
    }
    .requirements {
      font-size: 11px;
      color: #64748B;
      margin-top: 4px;
    }
    .footer {
      border-top: 1px solid #28233D;
      padding-top: 20px;
      margin-top: 24px;
      text-align: center;
      font-size: 12px;
      color: #64748B;
    }
    .footer-links {
      display: flex;
      justify-content: center;
      gap: 14px;
      margin-bottom: 8px;
    }
    .footer-links a {
      color: #94A3B8;
      text-decoration: none;
      transition: color 0.2s;
    }
    .footer-links a:hover {
      color: #A78BFA;
    }
    .sep {
      color: #475569;
    }
    .copyright {
      font-size: 11px;
      color: #475569;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">Mend<span>roo</span> <span class="brand-sub">Marketplace</span></div>
      <div class="official-badge">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        Official Account Security Portal
      </div>
      <h1 class="title">Set New Password</h1>
      <p class="subtitle">Secure password recovery for your Customer or Service Provider account.</p>
    </div>

    <div class="security-notice">
      🔒 <strong>Verified Endpoint:</strong> This password update form connects directly to <code>service-provider-marketplace.onrender.com</code>.
    </div>

    ${tokenInvalidOrExpired ? `
    <div class="alert alert-error" style="display: block;">
      ⚠️ <strong>Invalid or Expired Link</strong><br>
      This password reset link is invalid, has expired (links expire after 15 minutes), or has already been used.<br>
      Please return to the Mendroo Customer or Provider App to request a new link.
    </div>
    ` : ''}

    <div id="alertError" class="alert alert-error"></div>
    <div id="alertSuccess" class="alert alert-success"></div>

    <form id="resetForm" method="POST" action="/reset-password" enctype="application/x-www-form-urlencoded">
      <input type="hidden" name="token" id="token" value="${safeToken}">

      ${accountEmail ? `
      <div class="form-group">
        <label for="username">Account Identifier</label>
        <div class="input-wrapper">
          <input type="text" name="username" id="username" value="${accountEmail}" autocomplete="username" readonly style="color: #94A3B8; background: #0D0C17; cursor: default;">
        </div>
      </div>
      ` : `
      <input type="hidden" name="username" id="username" value="user" autocomplete="username">
      `}

      <div class="form-group">
        <label for="newPassword">New Password</label>
        <div class="input-wrapper">
          <input type="password" name="newPassword" id="newPassword" placeholder="Minimum 6 characters" required minlength="6" autocomplete="new-password" ${tokenInvalidOrExpired ? 'disabled' : ''}>
        </div>
        <div class="requirements">Must be at least 6 characters long</div>
      </div>

      <div class="form-group">
        <label for="confirmPassword">Confirm New Password</label>
        <div class="input-wrapper">
          <input type="password" name="confirmPassword" id="confirmPassword" placeholder="Re-enter new password" required minlength="6" autocomplete="new-password" ${tokenInvalidOrExpired ? 'disabled' : ''}>
        </div>
      </div>

      <div class="form-group">
        <label class="show-password-container">
          <input type="checkbox" id="showPasswords" ${tokenInvalidOrExpired ? 'disabled' : ''}> Show Passwords
        </label>
      </div>

      <button type="submit" id="submitBtn" class="btn" ${tokenInvalidOrExpired ? 'disabled' : ''}>Reset Password</button>
    </form>

    <div class="footer">
      <div class="footer-links">
        <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
        <span class="sep">&bull;</span>
        <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>
        <span class="sep">&bull;</span>
        <a href="/support" target="_blank" rel="noopener noreferrer">Help &amp; Support</a>
      </div>
      <div class="copyright">&copy; ${new Date().getFullYear()} Mendroo Service Provider Marketplace. All rights reserved.</div>
    </div>
  </div>

  <script nonce="${nonce}">
    const form = document.getElementById('resetForm');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const showPasswordsCheckbox = document.getElementById('showPasswords');
    const submitBtn = document.getElementById('submitBtn');
    const alertError = document.getElementById('alertError');
    const alertSuccess = document.getElementById('alertSuccess');

    // Extract token from input or URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = document.getElementById('token').value || urlParams.get('token') || '';

    if (!token) {
      alertError.textContent = 'Invalid or missing password reset token. Please request a new password reset email from your Mendroo Customer or Provider App.';
      alertError.style.display = 'block';
      submitBtn.disabled = true;
    }

    showPasswordsCheckbox.addEventListener('change', (e) => {
      const type = e.target.checked ? 'text' : 'password';
      newPasswordInput.type = type;
      confirmPasswordInput.type = type;
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      alertError.style.display = 'none';
      alertSuccess.style.display = 'none';

      const newPassword = newPasswordInput.value.trim();
      const confirmPassword = confirmPasswordInput.value.trim();

      if (!newPassword || newPassword.length < 6) {
        alertError.textContent = 'Password must be at least 6 characters long.';
        alertError.style.display = 'block';
        return;
      }

      if (newPassword !== confirmPassword) {
        alertError.textContent = 'Passwords do not match.';
        alertError.style.display = 'block';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Resetting Password...';

      try {
        const postUrl = form.action || window.location.pathname || '/reset-password';
        const response = await fetch(postUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ token, newPassword, confirmPassword })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          form.style.display = 'none';
          alertSuccess.innerHTML = '<strong>Success!</strong><br>' + (data.message || 'Your password has been reset successfully. You can now return to the Mendroo Customer or Provider App to log in.');
          alertSuccess.style.display = 'block';
        } else {
          const errMsg = data.error?.message || data.message || 'Failed to reset password. The link may have expired or was already used.';
          alertError.textContent = errMsg;
          alertError.style.display = 'block';
          submitBtn.disabled = false;
          submitBtn.textContent = 'Reset Password';
        }
      } catch (err) {
        alertError.textContent = 'A network error occurred. Please try again.';
        alertError.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Reset Password';
      }
    });
  </script>
</body>
</html>`;

  res.send(html);
};

  res.send(html);
};

const verifySmtp = async (req, res, next) => {
  try {
    const result = await emailService.verifyTransporter();
    res.status(result.success ? 200 : (result.configured ? 502 : 400)).json({
      success: result.success,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const sendTestEmail = async (req, res, next) => {
  try {
    const { to } = req.body;
    if (!to || typeof to !== 'string' || !to.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'A valid recipient email address is required in request body: { "to": "user@example.com" }'
      });
    }

    const result = await emailService.sendTestEmail({ to: to.trim().toLowerCase() });
    res.status(result.success ? 200 : 500).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerCustomer,
  loginCustomer,
  registerProvider,
  loginProvider,
  loginAdmin,
  getMe,
  forgotPassword,
  resetPassword,
  renderResetPasswordPage,
  verifySmtp,
  sendTestEmail
};
