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
  try {
    const result = await authService.resetPassword({
      token: req.body.token,
      newPassword: req.body.newPassword,
      confirmPassword: req.body.confirmPassword
    });
    res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    next(error);
  }
};

const renderResetPasswordPage = (req, res) => {
  const token = req.query.token || '';
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Password - Mendroo Marketplace</title>
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
      max-width: 440px;
      background: #161424;
      border: 1px solid #28233D;
      border-radius: 16px;
      padding: 36px 28px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    }
    .header {
      text-align: center;
      margin-bottom: 28px;
    }
    .brand {
      font-size: 26px;
      font-weight: 800;
      color: #FFFFFF;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .brand span {
      color: #8B5CF6;
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
      line-height: 1.4;
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #CBD5E1;
      margin-bottom: 8px;
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
      margin-top: 10px;
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
      margin-top: 6px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">Mend<span>roo</span></div>
      <div class="title">Set New Password</div>
      <div class="subtitle">Enter and confirm your new password below.</div>
    </div>

    <div id="alertError" class="alert alert-error"></div>
    <div id="alertSuccess" class="alert alert-success"></div>

    <form id="resetForm">
      <input type="hidden" id="token" value="${token}">

      <div class="form-group">
        <label for="newPassword">New Password</label>
        <div class="input-wrapper">
          <input type="password" id="newPassword" placeholder="Minimum 6 characters" required autocomplete="new-password">
        </div>
        <div class="requirements">Must be at least 6 characters long</div>
      </div>

      <div class="form-group">
        <label for="confirmPassword">Confirm New Password</label>
        <div class="input-wrapper">
          <input type="password" id="confirmPassword" placeholder="Re-enter new password" required autocomplete="new-password">
        </div>
      </div>

      <div class="form-group">
        <label class="show-password-container">
          <input type="checkbox" id="showPasswords"> Show Passwords
        </label>
      </div>

      <button type="submit" id="submitBtn" class="btn">Reset Password</button>
    </form>
  </div>

  <script>
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
      alertError.textContent = 'Invalid or missing password reset token. Please request a new password reset email.';
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
        const response = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, newPassword, confirmPassword })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          form.style.display = 'none';
          alertSuccess.innerHTML = '<strong>Success!</strong><br>' + (data.message || 'Your password has been reset successfully. You can now return to the app and log in.');
          alertSuccess.style.display = 'block';
        } else {
          const errMsg = data.error?.message || data.message || 'Failed to reset password. The link may have expired.';
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
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
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
