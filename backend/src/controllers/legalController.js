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
        <a href="/api/health">System Status</a>
      </div>
      <div>&copy; ${new Date().getFullYear()} Mendroo Service Provider Marketplace. All rights reserved.</div>
    </div>
  </div>
</body>
</html>`;

  res.send(html);
};

module.exports = {
  renderPrivacyPage,
  renderTermsPage,
  renderSupportPage
};
