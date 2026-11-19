/**
 * Legal & Transparency Controller
 * Serves official Privacy Policy, Terms of Service, and Platform Information.
 * Strengthens domain authenticity, Google Safe Browsing classification, and customer trust.
 */

const baseStyles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background-color: #0B0B0E;
    color: #E2E8F0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.6;
    padding: 30px 20px;
    min-height: 100vh;
  }
  .container {
    max-width: 800px;
    margin: 0 auto;
    background: #161424;
    border: 1px solid #28233D;
    border-radius: 16px;
    padding: 40px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
  }
  .header {
    text-align: center;
    border-bottom: 1px solid #28233D;
    padding-bottom: 24px;
    margin-bottom: 30px;
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
    font-size: 22px;
    font-weight: 700;
    color: #F8FAFC;
    margin-bottom: 6px;
  }
  .subtitle {
    font-size: 13px;
    color: #94A3B8;
  }
  h2 {
    font-size: 17px;
    color: #A78BFA;
    margin-top: 26px;
    margin-bottom: 10px;
    font-weight: 600;
  }
  p, li {
    font-size: 14px;
    color: #CBD5E1;
    margin-bottom: 14px;
  }
  ul {
    padding-left: 20px;
    margin-bottom: 14px;
  }
  .highlight-box {
    background-color: #12101F;
    border-left: 4px solid #8B5CF6;
    padding: 14px 18px;
    border-radius: 6px;
    margin: 20px 0;
    font-size: 13px;
    color: #E2E8F0;
  }
  .footer {
    border-top: 1px solid #28233D;
    padding-top: 24px;
    margin-top: 40px;
    text-align: center;
    font-size: 13px;
    color: #64748B;
  }
  .footer-links {
    display: flex;
    justify-content: center;
    gap: 20px;
    margin-bottom: 12px;
  }
  .footer-links a {
    color: #94A3B8;
    text-decoration: none;
    transition: color 0.2s;
  }
  .footer-links a:hover {
    color: #A78BFA;
  }
  @media (max-width: 600px) {
    .container { padding: 24px 18px; }
    body { padding: 15px 10px; }
  }
`;

const renderPrivacyPage = (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Official Privacy Policy for Mendroo Service Provider Marketplace. Learn how we safeguard user, customer, and provider information.">
  <meta name="robots" content="index, follow">
  <title>Privacy Policy - Mendroo Service Provider Marketplace</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">Mend<span>roo</span> Marketplace</div>
      <h1 class="title">Privacy Policy</h1>
      <div class="subtitle">Effective Date: November 2026 | Last Updated: November 11, 2026</div>
    </div>

    <div class="highlight-box">
      <strong>Mendroo Technologies</strong> operates the Mendroo Service Provider Marketplace. This policy outlines our commitment to protecting the personal data and security of our Customers and Service Providers.
    </div>

    <h2>1. Information We Collect</h2>
    <p>We collect only the information necessary to facilitate on-demand service connections between customers and verified service providers:</p>
    <ul>
      <li><strong>Account Credentials:</strong> Full name, verified email address, phone number, and securely hashed passwords (stored using industry-standard bcrypt encryption).</li>
      <li><strong>Service Details:</strong> Service location addresses, requested tasks, booking timestamps, and reviews.</li>
      <li><strong>Provider Verification:</strong> Experience years, business categories, and operational verification data for service professionals.</li>
    </ul>

    <h2>2. Password & Authentication Security</h2>
    <p>Your security is our highest priority:</p>
    <ul>
      <li>Passwords are never stored in plain text. We utilize salted, one-way bcrypt cryptographic hashes.</li>
      <li>Password reset tokens are generated cryptographically, hashed using SHA-256 before storage, expire strictly after 15 minutes, and cannot be reused once submitted.</li>
      <li>All platform interactions are encrypted in transit using Transport Layer Security (TLS 1.3 / HTTPS).</li>
    </ul>

    <h2>3. How We Use Information</h2>
    <p>Information is used exclusively to facilitate marketplace transactions, authenticate accounts, verify service dispatch, and prevent fraudulent activity. We never sell or lease personal data to third parties.</p>

    <h2>4. Contact Us</h2>
    <p>For inquiries regarding privacy, data deletion, or account management, contact our compliance team at <a href="mailto:support@mendroo.com" style="color: #A78BFA;">support@mendroo.com</a>.</p>

    <div class="footer">
      <div class="footer-links">
        <a href="/terms">Terms of Service</a>
        <a href="/support">Help & Support</a>
        <a href="/api/health">System Status</a>
      </div>
      <div>&copy; ${new Date().getFullYear()} Mendroo Service Provider Marketplace. All rights reserved.</div>
    </div>
  </div>
</body>
</html>`;

  res.send(html);
};

const renderTermsPage = (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Official Terms of Service for Mendroo Service Provider Marketplace. Understand customer and provider rights, responsibilities, and standards.">
  <meta name="robots" content="index, follow">
  <title>Terms of Service - Mendroo Service Provider Marketplace</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">Mend<span>roo</span> Marketplace</div>
      <h1 class="title">Terms of Service</h1>
      <div class="subtitle">Effective Date: November 2026 | Last Updated: November 11, 2026</div>
    </div>

    <div class="highlight-box">
      Welcome to <strong>Mendroo Service Provider Marketplace</strong>. By accessing our platform, customer app, provider app, or administrative services, you agree to comply with the terms below.
    </div>

    <h2>1. Marketplace Platform Overview</h2>
    <p>Mendroo connects registered customers seeking home and commercial maintenance services with vetted, skilled independent service providers. Mendroo provides the technology platform, scheduling engine, and secure payment mediation.</p>

    <h2>2. User Accounts & Security</h2>
    <ul>
      <li>Users are responsible for safeguarding their login credentials.</li>
      <li>Official account recovery must be performed exclusively through Mendroo verified HTTPS domains.</li>
      <li>You must immediately notify Mendroo support if you suspect unauthorized access to your account.</li>
    </ul>

    <h2>3. Service & Commission Policies</h2>
    <p>Bookings are subject to standard marketplace commissions configured by administrative oversight. Transparent breakdown of base service and approved labour charges is visible prior to job execution.</p>

    <h2>4. Acceptable Use</h2>
    <p>Users may not engage in deceptive practices, misrepresent qualifications, or attempt to circumvent security protections or authentication protocols on the platform.</p>

    <div class="footer">
      <div class="footer-links">
        <a href="/privacy">Privacy Policy</a>
        <a href="/support">Help & Support</a>
        <a href="/api/health">System Status</a>
      </div>
      <div>&copy; ${new Date().getFullYear()} Mendroo Service Provider Marketplace. All rights reserved.</div>
    </div>
  </div>
</body>
</html>`;

  res.send(html);
};

const renderSupportPage = (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Support and Help Center for Mendroo Service Provider Marketplace. Customer service, provider inquiries, and account recovery help.">
  <meta name="robots" content="index, follow">
  <title>Help & Support - Mendroo Service Provider Marketplace</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">Mend<span>roo</span> Support</div>
      <h1 class="title">Help & Support Center</h1>
      <div class="subtitle">Platform Assistance & Account Verification</div>
    </div>

    <div class="highlight-box">
      Need assistance with your customer account, provider verification, or booking? Our support team is ready to help.
    </div>

    <h2>Official Contact Channels</h2>
    <p>Please reach out via our official communication channels:</p>
    <ul>
      <li><strong>Official Helpline:</strong> <a href="tel:+918927721577" style="color: #A78BFA;">89277 21577</a></li>
      <li><strong>Support Email:</strong> <a href="mailto:support@mendroo.com" style="color: #A78BFA;">support@mendroo.com</a></li>
      <li><strong>Hours of Operation:</strong> Monday – Saturday, 8:00 AM – 8:00 PM IST</li>
      <li><strong>Platform Domain:</strong> <a href="https://service-provider-marketplace.onrender.com" style="color: #A78BFA;">https://service-provider-marketplace.onrender.com</a></li>
    </ul>

    <h2>Account Recovery Assistance</h2>
    <p>If you requested a password reset but did not receive an email, please check your spam folder or ensure you entered the exact email registered to your Customer or Provider profile. Password reset links expire 15 minutes after issuance.</p>

    <div class="footer">
      <div class="footer-links">
        <a href="/privacy">Privacy Policy</a>
        <a href="/terms">Terms of Service</a>
        <a href="/delete-account">Delete Account</a>
        <a href="/api/health">System Status</a>
      </div>
      <div>&copy; ${new Date().getFullYear()} Mendroo Service Provider Marketplace. All rights reserved.</div>
    </div>
  </div>
</body>
</html>`;

  res.send(html);
};

const renderAccountDeletionPage = (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Request account and personal data deletion for MENDROO Customer and Provider apps in accordance with Google Play Store User Data Policy.">
  <meta name="robots" content="index, follow">
  <title>Account Deletion Request - MENDROO Marketplace</title>
  <style>
    ${baseStyles}
    .form-group { margin-bottom: 18px; }
    label { display: block; font-size: 13px; font-weight: 600; color: #CBD5E1; margin-bottom: 6px; }
    input[type="text"], input[type="email"], select, textarea {
      width: 100%;
      padding: 12px 14px;
      border: 1px solid #3B3358;
      border-radius: 8px;
      background: #100E1C;
      color: #FFFFFF;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
    }
    input:focus, select:focus, textarea:focus { border-color: #7C3AED; }
    .btn-submit {
      width: 100%;
      background: #DC2626;
      color: #FFFFFF;
      font-weight: 700;
      padding: 14px;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      cursor: pointer;
      margin-top: 10px;
      transition: background-color 0.2s;
    }
    .btn-submit:hover { background: #B91C1C; }
    .checkbox-row {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 12px;
      color: #94A3B8;
      margin-top: 14px;
    }
    .checkbox-row input { margin-top: 3px; }
    .steps-card {
      background: #12101F;
      border: 1px solid #28233D;
      border-radius: 8px;
      padding: 18px;
      margin-bottom: 24px;
    }
    .steps-card ol { padding-left: 20px; color: #CBD5E1; font-size: 13px; line-height: 1.8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">Mend<span>roo</span> Marketplace</div>
      <h1 class="title">Account & Data Deletion Request</h1>
      <div class="subtitle">Google Play Store User Data Compliance & Transparency</div>
    </div>

    <div class="highlight-box">
      <strong>User Data Rights:</strong> In accordance with Google Play Developer Policy and data protection standards, users of <strong>MENDROO Customer</strong> and <strong>MENDROO Provider</strong> have the full right to delete their accounts and request erasure of associated personal data.
    </div>

    <h2>Option 1: Immediate In-App Deletion</h2>
    <div class="steps-card">
      <p style="margin-bottom: 8px; font-weight: 600; color: #A78BFA;">If you have the mobile app installed on your device:</p>
      <ol>
        <li>Open the <strong>MENDROO Customer</strong> or <strong>MENDROO Provider</strong> mobile app.</li>
        <li>Navigate to the <strong>Profile</strong> tab in the bottom navigation.</li>
        <li>Scroll down to the <strong>Account Management</strong> section.</li>
        <li>Tap <strong>Delete Account</strong> and confirm the prompt.</li>
        <li>Your account credentials, contact data, and active records will be permanently erased immediately.</li>
      </ol>
    </div>

    <h2>Option 2: Web Account Deletion Request Form</h2>
    <p>If you have uninstalled the app or cannot access your mobile device, please submit this deletion request form:</p>

    <form method="POST" action="/delete-account">
      <div class="form-group">
        <label for="accountType">Account Type *</label>
        <select id="accountType" name="accountType" required>
          <option value="customer">MENDROO Customer</option>
          <option value="provider">MENDROO Provider</option>
        </select>
      </div>

      <div class="form-group">
        <label for="identifier">Registered Email Address or Mobile Number *</label>
        <input type="text" id="identifier" name="identifier" placeholder="e.g. yourname@example.com or 9876543210" required />
      </div>

      <div class="form-group">
        <label for="reason">Reason for Deletion (Optional)</label>
        <textarea id="reason" name="reason" rows="3" placeholder="Tell us why you wish to delete your account..."></textarea>
      </div>

      <div class="checkbox-row">
        <input type="checkbox" id="consent" name="consent" required />
        <label for="consent">I confirm that I want to permanently delete my MENDROO account and understand that my personal profile, saved addresses, and active login access will be erased. Completed financial audit logs and tax receipts will be retained in an anonymized format as legally required by Indian tax statutes.</label>
      </div>

      <button type="submit" class="btn-submit">Submit Permanent Deletion Request</button>
    </form>

    <h2>Data Retention & Deletion Disclosures</h2>
    <ul>
      <li><strong>Data Permanently Deleted:</strong> Profile photo, full name, phone number, email address, physical service addresses, device push notification tokens, and authentication credentials.</li>
      <li><strong>Data Legally Retained:</strong> Under the Goods and Services Tax (GST) Act and the Companies Act, completed payment transaction receipts, booking invoice histories, and statutory tax records must be retained for legal audit periods in an anonymized format.</li>
    </ul>

    <h2>Need Assistance?</h2>
    <p>For urgent deletion verification or assistance, contact our dedicated compliance officer:</p>
    <ul>
      <li><strong>Helpline:</strong> <a href="tel:+918927721577" style="color: #A78BFA;">89277 21577</a> (Mon - Sat, 8:00 AM - 8:00 PM IST)</li>
      <li><strong>Compliance Email:</strong> <a href="mailto:support@mendroo.com" style="color: #A78BFA;">support@mendroo.com</a></li>
    </ul>

    <div class="footer">
      <div class="footer-links">
        <a href="/privacy">Privacy Policy</a>
        <a href="/terms">Terms of Service</a>
        <a href="/support">Help & Support</a>
        <a href="/api/health">System Status</a>
      </div>
      <div>&copy; ${new Date().getFullYear()} Mendroo Service Provider Marketplace. All rights reserved.</div>
    </div>
  </div>
</body>
</html>`;

  res.send(html);
};

const handleWebAccountDeletionRequest = async (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const { accountType, identifier, reason } = req.body;

  if (!identifier || !identifier.trim()) {
    return res.status(400).send(`<!DOCTYPE html><html><head><style>${baseStyles}</style></head><body><div class="container"><h1 class="title" style="color:#EF4444;">Invalid Request</h1><p>Please provide a valid registered email address or phone number.</p><a href="/delete-account" style="color:#A78BFA;">Go Back</a></div></body></html>`);
  }

  const cleanIdentifier = identifier.trim().toLowerCase();
  const User = require('../models/User');
  const Booking = require('../models/Booking');

  try {
    const user = await User.findOne({
      $or: [{ email: cleanIdentifier }, { phone: cleanIdentifier }]
    });

    const refId = `REQ-${Date.now().toString().slice(-6)}`;

    if (!user) {
      // Return safe message without exposing whether user exists
      const successHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Deletion Request Received - MENDROO Marketplace</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container" style="text-align: center;">
    <div class="header">
      <div class="brand">Mend<span>roo</span> Marketplace</div>
      <h1 class="title" style="color: #10B981;">Deletion Request Received</h1>
      <div class="subtitle">Reference Ticket: #${refId}</div>
    </div>
    <p>Your account deletion request for <strong>${cleanIdentifier}</strong> has been received and queued for review.</p>
    <p>If an active account corresponds to these details, personal records will be anonymized within 24-48 business hours. For any inquiries, contact <a href="mailto:support@mendroo.com" style="color: #A78BFA;">support@mendroo.com</a> or helpline <a href="tel:+918927721577" style="color: #A78BFA;">89277 21577</a>.</p>
    <div style="margin-top: 30px;">
      <a href="/delete-account" style="color: #A78BFA; text-decoration: none;">&larr; Return to Deletion Information</a>
    </div>
  </div>
</body>
</html>`;
      return res.send(successHtml);
    }

    // If user found, check if role is customer or provider
    if (user.role === 'customer') {
      const customerService = require('../services/customerService');
      await customerService.deleteCustomerSelf(user._id);
    } else if (user.role === 'provider') {
      const providerService = require('../services/providerService');
      await providerService.deleteProviderSelf(user._id);
    }

    console.log(`[WEB ACCOUNT DELETION] Executed for ${user._id} (${cleanIdentifier}) | Ref: ${refId} | Reason: ${reason || 'N/A'}`);

    const confirmedHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Account Deleted - MENDROO Marketplace</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container" style="text-align: center;">
    <div class="header">
      <div class="brand">Mend<span>roo</span> Marketplace</div>
      <h1 class="title" style="color: #10B981;">Account Deleted Successfully</h1>
      <div class="subtitle">Reference Ticket: #${refId}</div>
    </div>
    <div class="highlight-box">
      The MENDROO account associated with <strong>${cleanIdentifier}</strong> has been permanently deactivated and personal identification data has been erased.
    </div>
    <p>Your personal data has been deleted in compliance with Google Play Store policies and applicable privacy laws. In accordance with statutory tax and accounting standards, financial ledgers are retained in anonymized format.</p>
    <p>Helpline: <a href="tel:+918927721577" style="color: #A78BFA;">89277 21577</a> | Email: <a href="mailto:support@mendroo.com" style="color: #A78BFA;">support@mendroo.com</a></p>
    <div style="margin-top: 30px;">
      <a href="/delete-account" style="color: #A78BFA; text-decoration: none;">&larr; Return to Deletion Information</a>
    </div>
  </div>
</body>
</html>`;

    return res.send(confirmedHtml);
  } catch (err) {
    console.error('[WEB ACCOUNT DELETION ERROR]', err);
    return res.status(500).send(`<!DOCTYPE html><html><head><style>${baseStyles}</style></head><body><div class="container"><h1 class="title" style="color:#EF4444;">Processing Error</h1><p>${err.message || 'An error occurred while processing your request. Please contact support.'}</p><a href="/delete-account" style="color:#A78BFA;">Go Back</a></div></body></html>`);
  }
};

module.exports = {
  renderPrivacyPage,
  renderTermsPage,
  renderSupportPage,
  renderAccountDeletionPage,
  handleWebAccountDeletionRequest
};
