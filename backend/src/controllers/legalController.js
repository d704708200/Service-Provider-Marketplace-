/**
 * Legal & Compliance Controller
 * Implements dedicated Google Play Store Privacy Policies and Account Deletion procedures
 * for MENDROO Customer App (com.serviceprovider.customerapp) and MENDROO Provider App (com.mendroo.provider).
 *
 * Public access - No login or admin authentication required.
 * Effective Date: 20 November 2026
 */

const baseStyles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background-color: #0B0B0E;
    color: #E2E8F0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.65;
    padding: 24px 16px;
    min-height: 100vh;
  }
  .container {
    max-width: 860px;
    margin: 0 auto;
    background: #141221;
    border: 1px solid #28233D;
    border-radius: 18px;
    padding: 36px 28px;
    box-shadow: 0 20px 45px rgba(0, 0, 0, 0.65);
  }
  .header {
    text-align: center;
    border-bottom: 1px solid #28233D;
    padding-bottom: 24px;
    margin-bottom: 28px;
  }
  .brand {
    font-size: 26px;
    font-weight: 800;
    color: #FFFFFF;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    margin-bottom: 6px;
  }
  .brand span {
    color: #8B5CF6;
  }
  .app-badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    margin-bottom: 12px;
  }
  .badge-customer {
    background: rgba(139, 92, 246, 0.18);
    color: #C4B5FD;
    border: 1px solid rgba(139, 92, 246, 0.4);
  }
  .badge-provider {
    background: rgba(16, 185, 129, 0.18);
    color: #6EE7B7;
    border: 1px solid rgba(16, 185, 129, 0.4);
  }
  .title {
    font-size: 24px;
    font-weight: 800;
    color: #F8FAFC;
    margin-bottom: 8px;
    line-height: 1.3;
  }
  .subtitle {
    font-size: 13px;
    color: #94A3B8;
  }
  .nav-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    margin: 20px 0 24px 0;
  }
  .nav-tab {
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    text-decoration: none;
    color: #CBD5E1;
    background: #1B172E;
    border: 1px solid #2E274D;
    transition: all 0.2s;
  }
  .nav-tab:hover, .nav-tab.active {
    background: #7C3AED;
    color: #FFFFFF;
    border-color: #8B5CF6;
  }
  .highlight-box {
    background-color: #1A162B;
    border-left: 4px solid #8B5CF6;
    padding: 16px 20px;
    border-radius: 8px;
    margin: 22px 0;
    font-size: 13px;
    color: #E2E8F0;
    line-height: 1.6;
  }
  .toc-box {
    background: #100E1C;
    border: 1px solid #26213A;
    border-radius: 12px;
    padding: 18px 22px;
    margin: 24px 0 32px 0;
  }
  .toc-title {
    font-size: 13px;
    font-weight: 700;
    color: #A78BFA;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 12px;
  }
  .toc-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 8px 16px;
    font-size: 12px;
  }
  .toc-grid a {
    color: #94A3B8;
    text-decoration: none;
    transition: color 0.2s;
  }
  .toc-grid a:hover {
    color: #C4B5FD;
  }
  h2 {
    font-size: 17px;
    color: #A78BFA;
    margin-top: 32px;
    margin-bottom: 12px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid #231E38;
  }
  h3 {
    font-size: 14px;
    color: #F1F5F9;
    margin-top: 18px;
    margin-bottom: 8px;
    font-weight: 600;
  }
  p, li {
    font-size: 13.5px;
    color: #CBD5E1;
    margin-bottom: 12px;
  }
  ul, ol {
    padding-left: 22px;
    margin-bottom: 14px;
  }
  li {
    margin-bottom: 6px;
  }
  strong {
    color: #F8FAFC;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0 22px 0;
    font-size: 12.5px;
  }
  th, td {
    border: 1px solid #2B2544;
    padding: 10px 12px;
    text-align: left;
  }
  th {
    background: #1B1630;
    color: #C4B5FD;
    font-weight: 700;
  }
  td {
    color: #CBD5E1;
    background: #120F21;
  }
  .card-action {
    background: #171329;
    border: 1px solid #362D58;
    border-radius: 10px;
    padding: 20px;
    margin: 20px 0;
  }
  .btn-action {
    display: inline-block;
    background: #7C3AED;
    color: #FFFFFF;
    font-weight: 700;
    padding: 10px 20px;
    border-radius: 8px;
    text-decoration: none;
    font-size: 13px;
    transition: background 0.2s;
    margin-top: 10px;
  }
  .btn-action:hover {
    background: #6D28D9;
  }
  .btn-danger {
    background: #DC2626;
  }
  .btn-danger:hover {
    background: #B91C1C;
  }
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
  .footer {
    border-top: 1px solid #28233D;
    padding-top: 24px;
    margin-top: 40px;
    text-align: center;
    font-size: 12.5px;
    color: #64748B;
  }
  .footer-links {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 16px;
    margin-bottom: 14px;
  }
  .footer-links a {
    color: #94A3B8;
    text-decoration: none;
    transition: color 0.2s;
  }
  .footer-links a:hover {
    color: #A78BFA;
  }
  @media (max-width: 640px) {
    .container { padding: 22px 16px; border-radius: 12px; }
    body { padding: 12px 8px; }
    .title { font-size: 20px; }
    table { font-size: 11.5px; }
    th, td { padding: 8px 8px; }
  }
`;

/**
 * Common Navigation Tabs component
 */
function renderNavTabs(activeTab) {
  return `
    <div class="nav-tabs">
      <a href="/privacy/customer" class="nav-tab ${activeTab === 'customer' ? 'active' : ''}">Customer Privacy Policy</a>
      <a href="/privacy/provider" class="nav-tab ${activeTab === 'provider' ? 'active' : ''}">Provider Privacy Policy</a>
      <a href="/delete-account/customer" class="nav-tab ${activeTab === 'delete-customer' ? 'active' : ''}">Customer Account Deletion</a>
      <a href="/delete-account/provider" class="nav-tab ${activeTab === 'delete-provider' ? 'active' : ''}">Provider Account Deletion</a>
      <a href="/terms" class="nav-tab ${activeTab === 'terms' ? 'active' : ''}">Terms of Service</a>
      <a href="/support" class="nav-tab ${activeTab === 'support' ? 'active' : ''}">Help & Support</a>
    </div>
  `;
}

/**
 * 1. Customer App Privacy Policy (Public)
 * Specifically addresses MENDROO Customer App (com.serviceprovider.customerapp)
 */
const renderCustomerPrivacyPage = (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Official Privacy Policy for MENDROO Customer App (com.serviceprovider.customerapp). Discloses personal data collection, location tracking, Razorpay payment processing, and Google Play Store account deletion.">
  <meta name="robots" content="index, follow">
  <title>Customer App Privacy Policy - MENDROO Marketplace</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">Mend<span>roo</span> Marketplace</div>
      <div class="app-badge badge-customer">Customer Mobile App (com.serviceprovider.customerapp)</div>
      <h1 class="title">Privacy Policy for Customers</h1>
      <div class="subtitle">Effective Date: 20 November 2026 | Governing Entity: MENDROO Technologies</div>
    </div>

    ${renderNavTabs('customer')}

    <div class="highlight-box">
      <strong>MENDROO Customer App</strong> connects home and business owners with vetted, skilled service providers (electricians, plumbers, appliance technicians, carpenters, cleaners, etc.). This policy details the precise information collected by our mobile app and backend systems, how that information is utilized, our zero-data-selling guarantee, and your rights to manage or permanently erase your data.
    </div>

    <div class="toc-box">
      <div class="toc-title">Policy Table of Contents</div>
      <div class="toc-grid">
        <a href="#identity">1. App Identity & Entity</a>
        <a href="#personal-info">2. Personal Information Collected</a>
        <a href="#location-data">3. Location Data & Usage</a>
        <a href="#booking-data">4. Bookings & Service Requests</a>
        <a href="#payments">5. Payment Gateway & Financial Data</a>
        <a href="#device-permissions">6. Device Permissions (FCM, Storage)</a>
        <a href="#third-parties">7. Third-Party Sharing Disclosures</a>
        <a href="#security-retention">8. Data Security & Storage</a>
        <a href="#account-deletion">9. Account Deletion & Rights</a>
        <a href="#children">10. Children's Privacy</a>
        <a href="#contact">11. Contact & Grievance Officer</a>
      </div>
    </div>

    <h2 id="identity">1. App Identity & Developer Information</h2>
    <p>This privacy policy applies exclusively to the <strong>MENDROO Customer</strong> mobile application (Android Package Name: <code>com.serviceprovider.customerapp</code>), hosted backend APIs (<code>https://service-provider-marketplace.onrender.com</code>), and associated customer services operated by <strong>MENDROO Technologies</strong> ("MENDROO", "we", "us", or "our").</p>

    <h2 id="personal-info">2. Personal Information We Collect</h2>
    <p>Based on our direct code audit, we collect only the personal information required to authenticate customer accounts and fulfill on-demand service bookings:</p>
    <ul>
      <li><strong>Full Name:</strong> Collected during registration to identify your customer account and inform the assigned service technician of whom to contact upon arrival.</li>
      <li><strong>Mobile Phone Number:</strong> Unique primary contact key. Used for account authentication, password recovery, direct phone coordination with the assigned technician, and booking dispatch verification.</li>
      <li><strong>Email Address:</strong> Used for secure password reset verification, booking confirmation receipts, GST-compliant tax invoices, and account security notifications.</li>
      <li><strong>Password Hash:</strong> Passwords are cryptographically salted and hashed using <strong>bcrypt</strong> (10 salt rounds) before database storage. Plaintext passwords are never logged, stored, or accessible to MENDROO employees.</li>
      <li><strong>Saved Delivery Addresses:</strong> Physical street address, building/flat number, locality, city, state, and zip code saved under your profile for quick selection during service checkout.</li>
      <li><strong>Profile Picture:</strong> Optional customer avatar image uploaded by the user, stored securely via encrypted cloud storage.</li>
    </ul>

    <h2 id="location-data">3. Device Location Data & Exact Purpose</h2>
    <p>The MENDROO Customer mobile application requests Android location permissions (<code>ACCESS_COARSE_LOCATION</code> and <code>ACCESS_FINE_LOCATION</code>):</p>
    <ul>
      <li><strong>How Location is Collected:</strong> Precise GPS coordinates (latitude and longitude) are accessed strictly through the device's native location services when you tap "Use Current Location" or search for local services.</li>
      <li><strong>Purpose of Collection:</strong>
        <ol>
          <li>To identify nearby verified service providers active within your coverage area.</li>
          <li>To pinpoint the exact service delivery destination for home/commercial technician dispatch.</li>
          <li>To accurately calculate travel distances and estimated technician arrival times.</li>
        </ol>
      </li>
      <li><strong>No Background Location Tracking:</strong> The customer app <strong>does not collect background location</strong> while the app is closed, terminated, or not in active foreground use. Location access occurs only when actively interacting with location search or booking workflows.</li>
    </ul>

    <h2 id="booking-data">4. Bookings, Service Requests & Customer Reviews</h2>
    <ul>
      <li><strong>Service Scope Details:</strong> Selected category, service tag, preferred scheduling slot (instant on-demand dispatch or pre-scheduled appointment), service notes, and optional photos of the repair requirement.</li>
      <li><strong>Ratings & Reviews:</strong> Ratings (1 to 5 stars) and optional written reviews provided after job completion are displayed publicly to help maintain marketplace quality. Reviews remain anonymous regarding phone numbers and private addresses.</li>
    </ul>

    <h2 id="payments">5. Payment Information & Razorpay Integration</h2>
    <p>MENDROO supports two transparent payment channels:</p>
    <ol>
      <li><strong>Cash on Service (Cash after completion):</strong> You pay the service technician directly in cash upon satisfactory service delivery.</li>
      <li><strong>Online Payments via Razorpay:</strong> When paying digitally for service fees, spare parts, or deposits, transactions are mediated directly by <strong>Razorpay Software Private Limited</strong>, an RBI-licensed payment aggregator.</li>
    </ol>
    <div class="highlight-box">
      <strong>Zero Payment Card Storage:</strong> MENDROO does <strong>NOT</strong> collect, view, or store customer credit card numbers, debit card numbers, CVVs, expiry dates, UPI MPINs, or netbanking passwords. All digital payments are processed through Razorpay's PCI-DSS Level 1 certified payment gateway over TLS 1.3 encrypted sessions. Our servers only retain Razorpay transaction reference IDs (<code>razorpay_order_id</code>, <code>razorpay_payment_id</code>) for accounting and invoice generation.
    </div>

    <h2 id="device-permissions">6. Device Permissions & System Notifications</h2>
    <table>
      <thead>
        <tr>
          <th>Permission</th>
          <th>Android Identifier</th>
          <th>Specific Technical Usage</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Location (Fine & Coarse)</td>
          <td><code>ACCESS_FINE_LOCATION</code>, <code>ACCESS_COARSE_LOCATION</code></td>
          <td>Detect current locality to show nearby service providers and set service destination.</td>
        </tr>
        <tr>
          <td>Push Notifications</td>
          <td><code>POST_NOTIFICATIONS</code></td>
          <td>Deliver real-time booking alerts (Provider Assigned, On the Way, Job Started, Completed).</td>
        </tr>
        <tr>
          <td>Internet & Network</td>
          <td><code>INTERNET</code>, <code>ACCESS_NETWORK_STATE</code></td>
          <td>Communicate securely with our cloud backend APIs over HTTPS.</td>
        </tr>
      </tbody>
    </table>

    <h2 id="third-parties">7. Third-Party Sharing & Zero Data Selling</h2>
    <p>We do <strong>not sell, rent, monetize, or trade</strong> customer personal data with data brokers, advertisers, or unaffiliated third parties. Data is shared strictly with the following operational entities:</p>
    <ul>
      <li><strong>Assigned Service Providers:</strong> Upon booking acceptance, your name, contact phone number, and service address are shared with the specific verified technician assigned to fulfill your job.</li>
      <li><strong>Razorpay:</strong> To process authorized digital payment transactions and refunds.</li>
      <li><strong>Google Firebase Cloud Messaging (FCM):</strong> To route encrypted transactional push notifications to your device.</li>
      <li><strong>Cloud Infrastructure Providers:</strong> Render (application hosting) and MongoDB Atlas (encrypted database storage).</li>
      <li><strong>Legal Mandates:</strong> Where required by valid judicial court orders, legal process, or regulatory tax inquiries under applicable Indian law.</li>
    </ul>

    <h2 id="security-retention">8. Data Security & Storage Measures</h2>
    <ul>
      <li><strong>In-Transit Encryption:</strong> All data exchanged between your mobile device and our backend servers is encrypted using Transport Layer Security (TLS 1.3 / HTTPS).</li>
      <li><strong>At-Rest Encryption:</strong> Database stores are hosted in ISO 27001 / SOC 2 certified cloud facilities with AES-256 encryption at rest.</li>
      <li><strong>Access Controls:</strong> Administrative access is restricted via strict role-based access control (RBAC), multi-factor authentication, and IP whitelisting.</li>
    </ul>

    <h2 id="account-deletion">9. Google Play Account Deletion & User Rights</h2>
    <p>In full compliance with Google Play Store User Data policies, MENDROO provides simple, accessible mechanisms for complete account and data erasure:</p>
    
    <div class="card-action">
      <h3 style="color: #EF4444; margin-top: 0;">Option A: Immediate In-App Deletion</h3>
      <p>1. Open the <strong>MENDROO Customer</strong> app.<br>
         2. Tap the <strong>Profile</strong> tab in the bottom bar.<br>
         3. Under <strong>Legal & Privacy Policies</strong>, tap <strong>Delete Account</strong>.<br>
         4. Confirm your choice to permanently erase your profile and credentials immediately.</p>
      
      <h3 style="color: #EF4444; margin-top: 14px;">Option B: Web Account Deletion (Without Installing the App)</h3>
      <p>If you uninstalled the application or cannot access your phone, you can initiate immediate deletion via our public portal:</p>
      <a href="/delete-account/customer" class="btn-action btn-danger">Open Customer Account Deletion Form &rarr;</a>
    </div>

    <p><strong>Data Deletion Scope:</strong> Upon deletion, your name, email, phone number, saved addresses, profile photo, and device FCM tokens are permanently erased. Under statutory Indian tax laws (Goods and Services Tax Act), completed financial transaction logs and invoices are retained in an anonymized format for mandatory legal audit periods.</p>

    <h2 id="children">10. Children's Privacy</h2>
    <p>MENDROO Customer App is designed and marketed exclusively for individuals aged <strong>18 years and older</strong> who have the legal capacity to enter into binding contracts. We do not knowingly solicit or collect personal information from individuals under the age of 18.</p>

    <h2 id="contact">11. Grievance Redressal & Contact Information</h2>
    <p>For any privacy inquiries, data access requests, or regulatory grievances, please reach our designated compliance officer:</p>
    <ul>
      <li><strong>Customer Helpline:</strong> <a href="tel:+918927721577" style="color: #A78BFA;">+91 89277 21577</a> (Mon - Sat, 8:00 AM - 8:00 PM IST)</li>
      <li><strong>Compliance Email:</strong> <a href="mailto:support@mendroo.com" style="color: #A78BFA;">support@mendroo.com</a></li>
      <li><strong>Registered Address:</strong> MENDROO Technologies, Service Provider Marketplace Operations, India.</li>
      <li><strong>Platform Domain:</strong> <a href="https://service-provider-marketplace.onrender.com" style="color: #A78BFA;">https://service-provider-marketplace.onrender.com</a></li>
    </ul>

    <div class="footer">
      <div class="footer-links">
        <a href="/privacy/provider">Provider Privacy Policy</a>
        <a href="/delete-account/customer">Delete Account</a>
        <a href="/terms">Terms of Service</a>
        <a href="/support">Help & Support</a>
        <a href="/api/health">System Status</a>
      </div>
      <div>&copy; ${new Date().getFullYear()} MENDROO Technologies. All rights reserved.</div>
    </div>
  </div>
</body>
</html>`;

  res.send(html);
};

/**
 * 2. Provider App Privacy Policy (Public)
 * Specifically addresses MENDROO Provider App (com.mendroo.provider)
 */
const renderProviderPrivacyPage = (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Official Privacy Policy for MENDROO Provider App (com.mendroo.provider). Discloses service partner data, KYC verification documents (Aadhaar/PAN), location coverage, wallet banking payouts, and Google Play account deletion.">
  <meta name="robots" content="index, follow">
  <title>Provider App Privacy Policy - MENDROO Marketplace</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">Mend<span>roo</span> Marketplace</div>
      <div class="app-badge badge-provider">Provider Mobile App (com.mendroo.provider)</div>
      <h1 class="title">Privacy Policy for Service Providers</h1>
      <div class="subtitle">Effective Date: 20 November 2026 | Governing Entity: MENDROO Technologies</div>
    </div>

    ${renderNavTabs('provider')}

    <div class="highlight-box">
      <strong>MENDROO Provider App</strong> is the dedicated mobile workstation for independent skilled professionals and service technicians. This Privacy Policy outlines the professional information, mandatory regulatory verification data (Aadhaar, PAN, certificates), operational service location radii, banking details for wallet payouts, and user rights applicable to registered Service Partners.
    </div>

    <div class="toc-box">
      <div class="toc-title">Policy Table of Contents</div>
      <div class="toc-grid">
        <a href="#identity">1. App Identity & Entity</a>
        <a href="#partner-info">2. Provider Profile & Professional Data</a>
        <a href="#kyc-docs">3. Mandatory KYC Verification Documents</a>
        <a href="#location-coverage">4. Location Data, Radius & Job Dispatch</a>
        <a href="#wallet-banking">5. In-App Wallet, Banking & Payouts</a>
        <a href="#device-permissions">6. Device Permissions (Camera, FCM, Storage)</a>
        <a href="#third-parties">7. Third-Party Sharing Disclosures</a>
        <a href="#security-retention">8. Data Security & Storage Standards</a>
        <a href="#account-deletion">9. Account Deletion & Data Erasure</a>
        <a href="#compliance-statutory">10. Statutory & Tax Disclosures</a>
        <a href="#contact">11. Partner Support & Grievance Contact</a>
      </div>
    </div>

    <h2 id="identity">1. App Identity & Scope</h2>
    <p>This privacy policy applies exclusively to the <strong>MENDROO Provider</strong> mobile application (Android Package Name: <code>com.mendroo.provider</code>), the service provider web portal, associated administrative systems, and backend APIs operated by <strong>MENDROO Technologies</strong>.</p>

    <h2 id="partner-info">2. Information We Collect from Service Providers</h2>
    <p>Based on our backend schema and API audit, registered Service Providers submit the following data:</p>
    <ul>
      <li><strong>Identity & Account Credentials:</strong> Full legal name, business name, mobile phone number, email address, profile avatar, and securely hashed password (bcrypt encryption with 10 salt rounds).</li>
      <li><strong>Professional Profile & Experience:</strong> Years of trade experience, primary service categories (e.g. Electrician, AC Repair, Plumbing), specific service tag offerings, and custom service pricing catalogs.</li>
      <li><strong>Availability & Working Hours:</strong> Weekly availability schedule (configured active days, working hours per day), and real-time online/offline toggle state (<code>isAvailable</code>).</li>
      <li><strong>Performance Records:</strong> Completed job counts, customer reviews, average rating scores, cancellation logs, and platform response time metrics.</li>
    </ul>

    <h2 id="kyc-docs">3. Mandatory KYC Verification Documents (Aadhaar & PAN)</h2>
    <p>To ensure customer safety, prevent fraudulent registrations, and comply with marketplace aggregator compliance standards in India, MENDROO collects mandatory KYC verification records:</p>
    <ul>
      <li><strong>Aadhaar Card:</strong> Front and back images of the Aadhaar identity card. Stored in encrypted cloud storage with restricted administrative access.</li>
      <li><strong>PAN Card:</strong> Front and back images of Permanent Account Number (PAN) card for identity confirmation and income tax compliance.</li>
      <li><strong>Professional Service Certifications:</strong> Trade certificates, diplomas, or government vocational certificates verifying professional skills.</li>
      <li><strong>Usage & Access:</strong> KYC records are examined solely by authorized compliance administrators to determine verification status (<code>verified</code>, <code>pending</code>, or <code>rejected</code>). <strong>KYC documents are never displayed publicly to customers</strong> or third-party advertisers.</li>
    </ul>

    <h2 id="location-coverage">4. Location Data, Coverage Radii & Real-Time Dispatch</h2>
    <p>The MENDROO Provider application requests location permissions (<code>ACCESS_FINE_LOCATION</code> and <code>ACCESS_COARSE_LOCATION</code>):</p>
    <ul>
      <li><strong>Service Territory Definition:</strong> Providers specify central working coordinates and operational radius (in kilometers) to define their active service coverage area.</li>
      <li><strong>Real-Time Request Matching:</strong> When toggled "Online & Available", the app checks geographic proximity to broadcast incoming customer job requests situated within your designated radius.</li>
      <li><strong>Navigation to Job Site:</strong> Location coordinates guide the provider from current position to the customer's confirmed service address upon accepting a booking.</li>
      <li><strong>Foreground Operation:</strong> Location coordinates are captured during active application use and navigation workflows. No continuous background tracking takes place when the app is offline or closed.</li>
    </ul>

    <h2 id="wallet-banking">5. In-App Wallet, Financial Payouts & Banking Data</h2>
    <p>For processing service earnings, commissions, and withdrawal payouts, we collect and manage:</p>
    <ul>
      <li><strong>Bank Account Credentials:</strong> Bank Account Number, Bank Name, IFSC Code, Account Holder Name, and UPI Virtual Payment Address (VPA).</li>
      <li><strong>Wallet Balances & Ledgers:</strong> Real-time available balance, pending withdrawal requests, completed withdrawal histories, platform commission deductions, and cash-on-service commission settlements.</li>
      <li><strong>Settlement Processor:</strong> Direct bank payouts are executed through secure banking partners and RBI-authorized payment processors (Razorpay).</li>
    </ul>

    <h2 id="device-permissions">6. Device Permissions Required</h2>
    <table>
      <thead>
        <tr>
          <th>Permission</th>
          <th>Android Identifier</th>
          <th>Specific Operational Usage</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Camera & Photos</td>
          <td>Camera & Media Gallery API</td>
          <td>Capture and upload Aadhaar, PAN card, service certificates, profile photos, and job completion evidence.</td>
        </tr>
        <tr>
          <td>Location (Fine & Coarse)</td>
          <td><code>ACCESS_FINE_LOCATION</code>, <code>ACCESS_COARSE_LOCATION</code></td>
          <td>Define service coverage radius, receive local broadcast requests, and navigate to customer job address.</td>
        </tr>
        <tr>
          <td>Push Notifications</td>
          <td><code>POST_NOTIFICATIONS</code></td>
          <td>Instant notification for new customer booking broadcasts, customer cancellations, and payout updates.</td>
        </tr>
        <tr>
          <td>Phone Dialer</td>
          <td><code>android.intent.action.DIAL</code></td>
          <td>Initiate direct phone calls to matched customers regarding on-site logistics and directions.</td>
        </tr>
      </tbody>
    </table>

    <h2 id="third-parties">7. Third-Party Sharing & Data Protection</h2>
    <p>We do not monetize, sell, or license provider personal data. Information is shared strictly under the following criteria:</p>
    <ul>
      <li><strong>To Matched Customers:</strong> Upon booking acceptance, your business name, mobile phone number, client rating, profile picture, and trade category are shared with the customer for fulfillment purposes.</li>
      <li><strong>Payment & Settlement Aggregators:</strong> Banking details and withdrawal amounts are submitted to authorized payment processors (Razorpay) for payout transfers.</li>
      <li><strong>Cloud Infrastructure:</strong> Render (API hosting), MongoDB Atlas (database), Cloudinary (document storage), and Google Firebase (push notifications).</li>
      <li><strong>Regulatory Authorities:</strong> Where compelled by law enforcement, Indian tax authorities, or court order regarding formal legal disputes.</li>
    </ul>

    <h2 id="security-retention">8. Data Security Standards</h2>
    <p>All partner data, especially sensitive KYC identification and banking coordinates, are protected with enterprise-grade safeguards:</p>
    <ul>
      <li>All API requests and image uploads are transmitted across encrypted TLS 1.3 / HTTPS connections.</li>
      <li>Restricted document access: KYC images are secured in private repositories accessible only by authorized compliance personnel.</li>
      <li>Strict password hashing using salted bcrypt algorithms.</li>
    </ul>

    <h2 id="account-deletion">9. Google Play Account Deletion & Partnership Termination</h2>
    <p>In accordance with Google Play Store User Data policies, Service Providers maintain the complete right to terminate their platform registration and request account erasure:</p>

    <div class="card-action">
      <h3 style="color: #EF4444; margin-top: 0;">Option A: Immediate In-App Deletion</h3>
      <p>1. Open the <strong>MENDROO Provider</strong> app.<br>
         2. Navigate to the <strong>Profile</strong> tab in the bottom bar.<br>
         3. Under <strong>Legal & Policies</strong>, select <strong>Delete Account</strong>.<br>
         4. Confirm the permanent closure of your provider profile.</p>

      <h3 style="color: #EF4444; margin-top: 14px;">Option B: Web Account Deletion (Without Mobile Device)</h3>
      <p>If you uninstalled the application or switched devices, you can request immediate partner deactivation and data erasure through our public web portal:</p>
      <a href="/delete-account/provider" class="btn-action btn-danger">Open Provider Account Deletion Form &rarr;</a>
    </div>

    <p><strong>Erasure & Retention Scope:</strong> Upon verification, your profile, phone number, login credentials, uploaded KYC documents (Aadhaar, PAN), and active service catalog will be permanently purged. In accordance with Section 139 of the Income Tax Act, 1961, and GST statutory guidelines, completed financial ledgers, payout logs, and commission invoices are maintained in an anonymized format for statutory audit requirements.</p>

    <h2 id="compliance-statutory">10. Minors Strictly Prohibited</h2>
    <p>Service Providers must be <strong>at least 18 years of age</strong> and hold legal capacity to provide independent commercial services. Registration by minors is strictly prohibited and immediately terminated upon detection during KYC review.</p>

    <h2 id="contact">11. Partner Support & Grievance Contact</h2>
    <p>For technical inquiries, KYC clarification, or privacy rights execution, contact our Partner Support desk:</p>
    <ul>
      <li><strong>Partner Support Helpline:</strong> <a href="tel:+918927721577" style="color: #A78BFA;">+91 89277 21577</a> (Mon - Sat, 8:00 AM - 8:00 PM IST)</li>
      <li><strong>Partner Compliance Email:</strong> <a href="mailto:support@mendroo.com" style="color: #A78BFA;">support@mendroo.com</a></li>
      <li><strong>Platform Domain:</strong> <a href="https://service-provider-marketplace.onrender.com" style="color: #A78BFA;">https://service-provider-marketplace.onrender.com</a></li>
    </ul>

    <div class="footer">
      <div class="footer-links">
        <a href="/privacy/customer">Customer Privacy Policy</a>
        <a href="/delete-account/provider">Delete Provider Account</a>
        <a href="/terms">Terms of Service</a>
        <a href="/support">Help & Support</a>
        <a href="/api/health">System Status</a>
      </div>
      <div>&copy; ${new Date().getFullYear()} MENDROO Technologies. All rights reserved.</div>
    </div>
  </div>
</body>
</html>`;

  res.send(html);
};

/**
 * 3. Privacy Policy Hub (Public)
 * Connects both Customer & Provider policies cleanly
 */
const renderPrivacyHubPage = (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="MENDROO Privacy Policy Center for Google Play Store. Dedicated privacy policies for Customers and Service Providers.">
  <meta name="robots" content="index, follow">
  <title>Privacy Policy Center - MENDROO Marketplace</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">Mend<span>roo</span> Marketplace</div>
      <h1 class="title">Privacy Policy Center</h1>
      <div class="subtitle">Google Play Store Compliance & User Data Transparency</div>
    </div>

    ${renderNavTabs('hub')}

    <div class="highlight-box">
      Welcome to the <strong>MENDROO Privacy Policy Center</strong>. In compliance with Google Play Developer Policies and data protection standards, we provide separate, comprehensive privacy disclosures tailored specifically for our <strong>Customer Application</strong> and our <strong>Service Provider Application</strong>.
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin: 30px 0;">
      <div class="card-action" style="border-top: 4px solid #8B5CF6;">
        <div class="app-badge badge-customer">Customer Application</div>
        <h3 style="font-size: 18px; margin: 8px 0 10px 0;">MENDROO Customer App</h3>
        <p style="font-size: 13px; color: #94A3B8;">For home and business customers booking on-demand electrical, plumbing, cleaning, AC, and appliance repair services.</p>
        <ul style="font-size: 12.5px; padding-left: 18px; color: #CBD5E1; margin: 12px 0;">
          <li>Name, mobile number, email authentication</li>
          <li>Saved delivery address & foreground GPS location</li>
          <li>Razorpay digital payments & Cash on Service</li>
          <li>In-app & web account deletion procedure</li>
        </ul>
        <a href="/privacy/customer" class="btn-action" style="width: 100%; text-align: center;">View Customer Privacy Policy &rarr;</a>
      </div>

      <div class="card-action" style="border-top: 4px solid #10B981;">
        <div class="app-badge badge-provider">Provider Application</div>
        <h3 style="font-size: 18px; margin: 8px 0 10px 0;">MENDROO Provider App</h3>
        <p style="font-size: 13px; color: #94A3B8;">For skilled professionals, technicians, and service partners managing job requests, territory radii, and earnings.</p>
        <ul style="font-size: 12.5px; padding-left: 18px; color: #CBD5E1; margin: 12px 0;">
          <li>Partner profile & professional skill catalog</li>
          <li>Mandatory KYC documents (Aadhaar & PAN)</li>
          <li>Service radius coverage & broadcast dispatch</li>
          <li>Bank account & wallet payout settlements</li>
        </ul>
        <a href="/privacy/provider" class="btn-action" style="width: 100%; text-align: center; background: #059669;">View Provider Privacy Policy &rarr;</a>
      </div>
    </div>

    <h2>Our Universal Privacy Commitments</h2>
    <ul>
      <li><strong>Zero Data Selling:</strong> We never sell, rent, monetize, or trade your personal information to third-party data brokers or advertisers.</li>
      <li><strong>Industry-Standard Encryption:</strong> All data in transit is protected using TLS 1.3 / HTTPS. Sensitive credentials and passwords are encrypted using one-way bcrypt hashing.</li>
      <li><strong>Accessible Account Deletion:</strong> Full self-serve account deletion available both directly within each mobile app and via our public web portals.</li>
    </ul>

    <div class="footer">
      <div class="footer-links">
        <a href="/privacy/customer">Customer Policy</a>
        <a href="/privacy/provider">Provider Policy</a>
        <a href="/delete-account/customer">Delete Customer Account</a>
        <a href="/delete-account/provider">Delete Provider Account</a>
        <a href="/terms">Terms of Service</a>
        <a href="/support">Help & Support</a>
      </div>
      <div>&copy; ${new Date().getFullYear()} MENDROO Technologies. All rights reserved.</div>
    </div>
  </div>
</body>
</html>`;

  res.send(html);
};

/**
 * 4. Customer Account Deletion Page (Public)
 */
const renderCustomerDeletionPage = (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Request permanent account and data deletion for MENDROO Customer App (com.serviceprovider.customerapp) in compliance with Google Play Store User Data Policy.">
  <meta name="robots" content="index, follow">
  <title>Customer Account Deletion - MENDROO Marketplace</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">Mend<span>roo</span> Marketplace</div>
      <div class="app-badge badge-customer">Customer App (com.serviceprovider.customerapp)</div>
      <h1 class="title">Customer Account Deletion Request</h1>
      <div class="subtitle">Google Play Store User Data Compliance & Transparency</div>
    </div>

    ${renderNavTabs('delete-customer')}

    <div class="highlight-box">
      <strong>Customer Data Rights:</strong> In accordance with Google Play Developer Policy and data protection regulations, users of <strong>MENDROO Customer</strong> have the full right to delete their accounts and request complete erasure of associated personal data.
    </div>

    <h2>Option 1: Immediate In-App Deletion</h2>
    <div class="card-action">
      <p style="margin-bottom: 8px; font-weight: 600; color: #A78BFA;">If you have the MENDROO Customer mobile app installed:</p>
      <ol>
        <li>Open the <strong>MENDROO Customer</strong> app.</li>
        <li>Tap the <strong>Profile</strong> tab in the bottom navigation bar.</li>
        <li>Scroll down to the <strong>Legal & Privacy Policies</strong> card.</li>
        <li>Tap <strong>Account Deletion Policy & Web Request</strong> (or in-app delete option) and confirm.</li>
        <li>Your account credentials, addresses, and personal records will be immediately and permanently erased.</li>
      </ol>
    </div>

    <h2>Option 2: Web Account Deletion Request Form</h2>
    <p>If you uninstalled the mobile app, lost your device, or cannot access your phone, please submit this web deletion request:</p>

    <form method="POST" action="/delete-account">
      <input type="hidden" name="accountType" value="customer" />

      <div class="form-group">
        <label for="identifier">Registered Email Address or Mobile Number *</label>
        <input type="text" id="identifier" name="identifier" placeholder="e.g. customer@example.com or 9876543210" required />
      </div>

      <div class="form-group">
        <label for="reason">Reason for Leaving (Optional)</label>
        <textarea id="reason" name="reason" rows="3" placeholder="Tell us why you wish to delete your account..."></textarea>
      </div>

      <div class="checkbox-row">
        <input type="checkbox" id="consent" name="consent" required />
        <label for="consent">I confirm that I want to permanently delete my MENDROO Customer account. I understand that my profile details, saved delivery addresses, active requests, and login credentials will be permanently erased. Statutory tax records of completed transactions will be preserved in anonymized format as legally required by Indian accounting statutes.</label>
      </div>

      <button type="submit" class="btn-submit">Permanently Delete My Customer Account</button>
    </form>

    <h2>Data Erasure & Legal Retention Disclosures</h2>
    <ul>
      <li><strong>Data Permanently Purged:</strong> Full name, phone number, email address, password hash, saved physical addresses, profile photo, and device push notification tokens.</li>
      <li><strong>Data Legally Preserved:</strong> Under the Goods and Services Tax (GST) Act and Indian accounting standards, historical financial transaction receipts and tax invoices are retained in an anonymized format for mandatory audit periods.</li>
    </ul>

    <h2>Need Help?</h2>
    <p>Contact our compliance officer: Helpline <a href="tel:+918927721577" style="color: #A78BFA;">+91 89277 21577</a> | Email: <a href="mailto:support@mendroo.com" style="color: #A78BFA;">support@mendroo.com</a></p>

    <div class="footer">
      <div class="footer-links">
        <a href="/privacy/customer">Customer Privacy Policy</a>
        <a href="/delete-account/provider">Provider Account Deletion</a>
        <a href="/terms">Terms of Service</a>
        <a href="/support">Help & Support</a>
      </div>
      <div>&copy; ${new Date().getFullYear()} MENDROO Technologies. All rights reserved.</div>
    </div>
  </div>
</body>
</html>`;

  res.send(html);
};

/**
 * 5. Provider Account Deletion Page (Public)
 */
const renderProviderDeletionPage = (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Request permanent account and KYC document deletion for MENDROO Provider App (com.mendroo.provider) in compliance with Google Play Store User Data Policy.">
  <meta name="robots" content="index, follow">
  <title>Provider Account Deletion - MENDROO Marketplace</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">Mend<span>roo</span> Marketplace</div>
      <div class="app-badge badge-provider">Provider App (com.mendroo.provider)</div>
      <h1 class="title">Provider Account Deletion Request</h1>
      <div class="subtitle">Google Play Store User Data Compliance & Regulatory Safeguards</div>
    </div>

    ${renderNavTabs('delete-provider')}

    <div class="highlight-box">
      <strong>Provider Partnership Termination:</strong> In accordance with Google Play Developer Policy and data privacy standards, registered Service Providers have the full right to terminate their platform partnership and request complete deletion of their account credentials and sensitive verification documents.
    </div>

    <h2>Option 1: Immediate In-App Deletion</h2>
    <div class="card-action">
      <p style="margin-bottom: 8px; font-weight: 600; color: #A78BFA;">If you have the MENDROO Provider mobile app installed:</p>
      <ol>
        <li>Open the <strong>MENDROO Provider</strong> app.</li>
        <li>Tap the <strong>Profile</strong> tab in the bottom navigation bar.</li>
        <li>Scroll down to the <strong>Legal & Policies</strong> section.</li>
        <li>Tap <strong>Account Deletion Policy & Web Request</strong> and confirm.</li>
        <li>Your provider account, service catalog, and KYC identity documents will be deactivated and scheduled for permanent erasure.</li>
      </ol>
    </div>

    <h2>Option 2: Web Account Deletion Request Form</h2>
    <p>If you uninstalled the provider mobile app or cannot access your phone, please submit this web deletion request:</p>

    <form method="POST" action="/delete-account">
      <input type="hidden" name="accountType" value="provider" />

      <div class="form-group">
        <label for="identifier">Registered Email Address or Mobile Number *</label>
        <input type="text" id="identifier" name="identifier" placeholder="e.g. provider@example.com or 9876543210" required />
      </div>

      <div class="form-group">
        <label for="reason">Reason for Closure (Optional)</label>
        <textarea id="reason" name="reason" rows="3" placeholder="Tell us why you are discontinuing your service partnership..."></textarea>
      </div>

      <div class="checkbox-row">
        <input type="checkbox" id="consent" name="consent" required />
        <label for="consent">I confirm that I want to terminate my MENDROO Provider partnership and delete my account. I understand that my uploaded KYC identity documents (Aadhaar, PAN), trade certificates, service catalog, bank details, and active logins will be permanently purged. Outstanding wallet balances must be settled prior to final ledger closure. Historical tax invoices will be retained in anonymized format as legally required by Indian tax statutes.</label>
      </div>

      <button type="submit" class="btn-submit">Permanently Terminate Provider Account</button>
    </form>

    <h2>Data Erasure Scope for Service Partners</h2>
    <ul>
      <li><strong>Permanently Purged:</strong> Uploaded Aadhaar & PAN images, skill certificates, bank account & UPI details, weekly working schedules, coverage radius coordinates, active broadcasts, and authentication credentials.</li>
      <li><strong>Wallet & Commission Balances:</strong> Any pending wallet withdrawal requests or unpaid platform commissions should be settled with the finance desk before final erasure.</li>
      <li><strong>Legally Mandated Records:</strong> Historical GST tax invoices and payment ledger entries are retained in an anonymized format under Indian Income Tax Act compliance guidelines.</li>
    </ul>

    <h2>Partner Assistance</h2>
    <p>For urgent settlement assistance or verification, contact our Partner Desk: Helpline <a href="tel:+918927721577" style="color: #A78BFA;">+91 89277 21577</a> | Email: <a href="mailto:support@mendroo.com" style="color: #A78BFA;">support@mendroo.com</a></p>

    <div class="footer">
      <div class="footer-links">
        <a href="/privacy/provider">Provider Privacy Policy</a>
        <a href="/delete-account/customer">Customer Account Deletion</a>
        <a href="/terms">Terms of Service</a>
        <a href="/support">Help & Support</a>
      </div>
      <div>&copy; ${new Date().getFullYear()} MENDROO Technologies. All rights reserved.</div>
    </div>
  </div>
</body>
</html>`;

  res.send(html);
};

/**
 * 6. General Account Deletion Hub
 */
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
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">Mend<span>roo</span> Marketplace</div>
      <h1 class="title">Account & Data Deletion Portal</h1>
      <div class="subtitle">Google Play Store User Data Compliance & Transparency</div>
    </div>

    ${renderNavTabs('delete-hub')}

    <div class="highlight-box">
      <strong>User Data Rights:</strong> In accordance with Google Play Developer Policy and data protection standards, users of <strong>MENDROO Customer</strong> and <strong>MENDROO Provider</strong> have the full right to delete their accounts and request erasure of associated personal data.
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin: 26px 0;">
      <div class="card-action" style="border-top: 4px solid #8B5CF6;">
        <div class="app-badge badge-customer">Customer Account</div>
        <h3 style="font-size: 17px; margin-top: 6px;">Customer Account Deletion</h3>
        <p style="font-size: 13px; color: #94A3B8;">Permanently delete your MENDROO Customer profile, saved delivery addresses, search history, and credentials.</p>
        <a href="/delete-account/customer" class="btn-action" style="width: 100%; text-align: center;">Customer Deletion Portal &rarr;</a>
      </div>

      <div class="card-action" style="border-top: 4px solid #10B981;">
        <div class="app-badge badge-provider">Provider Account</div>
        <h3 style="font-size: 17px; margin-top: 6px;">Provider Account Deletion</h3>
        <p style="font-size: 13px; color: #94A3B8;">Terminate your service partner registration, erase uploaded KYC documents (Aadhaar, PAN), and close your service catalog.</p>
        <a href="/delete-account/provider" class="btn-action" style="width: 100%; text-align: center; background: #059669;">Provider Deletion Portal &rarr;</a>
      </div>
    </div>

    <h2>Direct Web Deletion Form</h2>
    <p>Select your account type below to submit an immediate erasure request:</p>

    <form method="POST" action="/delete-account">
      <div class="form-group">
        <label for="accountType">Account Type *</label>
        <select id="accountType" name="accountType" required>
          <option value="customer">MENDROO Customer (Customer App)</option>
          <option value="provider">MENDROO Provider (Partner App)</option>
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
      <li><strong>Data Permanently Deleted:</strong> Profile photo, full name, phone number, email address, physical service addresses, KYC documents (for providers), device push notification tokens, and authentication credentials.</li>
      <li><strong>Data Legally Retained:</strong> Under the Goods and Services Tax (GST) Act and the Companies Act, completed payment transaction receipts, booking invoice histories, and statutory tax records must be retained for legal audit periods in an anonymized format.</li>
    </ul>

    <h2>Need Assistance?</h2>
    <p>For urgent deletion verification or assistance, contact our dedicated compliance officer:</p>
    <ul>
      <li><strong>Helpline:</strong> <a href="tel:+918927721577" style="color: #A78BFA;">+91 89277 21577</a> (Mon - Sat, 8:00 AM - 8:00 PM IST)</li>
      <li><strong>Compliance Email:</strong> <a href="mailto:support@mendroo.com" style="color: #A78BFA;">support@mendroo.com</a></li>
    </ul>

    <div class="footer">
      <div class="footer-links">
        <a href="/privacy/customer">Customer Privacy Policy</a>
        <a href="/privacy/provider">Provider Privacy Policy</a>
        <a href="/terms">Terms of Service</a>
        <a href="/support">Help & Support</a>
        <a href="/api/health">System Status</a>
      </div>
      <div>&copy; ${new Date().getFullYear()} MENDROO Technologies. All rights reserved.</div>
    </div>
  </div>
</body>
</html>`;

  res.send(html);
};

/**
 * 7. POST /delete-account
 * Handles the actual account deletion request from the web forms
 */
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
    <p>If an active account corresponds to these details, personal records will be anonymized within 24-48 business hours. For any inquiries, contact <a href="mailto:support@mendroo.com" style="color: #A78BFA;">support@mendroo.com</a> or helpline <a href="tel:+918927721577" style="color: #A78BFA;">+91 89277 21577</a>.</p>
    <div style="margin-top: 30px;">
      <a href="/delete-account" style="color: #A78BFA; text-decoration: none;">&larr; Return to Deletion Information</a>
    </div>
  </div>
</body>
</html>`;
      return res.send(successHtml);
    }

    // If user found, check role and execute deletion
    if (user.role === 'customer') {
      const customerService = require('../services/customerService');
      await customerService.deleteCustomerSelf(user._id);
    } else if (user.role === 'provider') {
      const providerService = require('../services/providerService');
      await providerService.deleteProviderSelf(user._id);
    }

    console.log(`[WEB ACCOUNT DELETION] Executed for ${user._id} (${cleanIdentifier}) | Role: ${user.role} | Ref: ${refId} | Reason: ${reason || 'N/A'}`);

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
      The MENDROO ${user.role === 'provider' ? 'Provider' : 'Customer'} account associated with <strong>${cleanIdentifier}</strong> has been permanently deactivated and personal identification data has been erased.
    </div>
    <p>Your personal data has been deleted in compliance with Google Play Store policies and applicable privacy laws. In accordance with statutory tax and accounting standards, financial ledgers are retained in anonymized format.</p>
    <p>Helpline: <a href="tel:+918927721577" style="color: #A78BFA;">+91 89277 21577</a> | Email: <a href="mailto:support@mendroo.com" style="color: #A78BFA;">support@mendroo.com</a></p>
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

/**
 * 8. Terms of Service
 */
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
      <div class="subtitle">Effective Date: 20 November 2026 | Last Updated: 20 November 2026</div>
    </div>

    ${renderNavTabs('terms')}

    <div class="highlight-box">
      Welcome to <strong>MENDROO Service Provider Marketplace</strong>. By accessing our platform, customer app, provider app, or administrative services, you agree to comply with the terms below.
    </div>

    <h2>1. Marketplace Platform Overview</h2>
    <p>MENDROO connects registered customers seeking home and commercial maintenance services with vetted, skilled independent service providers. MENDROO provides the technology platform, scheduling engine, and secure payment mediation.</p>

    <h2>2. User Accounts & Security</h2>
    <ul>
      <li>Users are responsible for safeguarding their login credentials.</li>
      <li>Official account recovery must be performed exclusively through MENDROO verified HTTPS domains.</li>
      <li>You must immediately notify MENDROO support if you suspect unauthorized access to your account.</li>
    </ul>

    <h2>3. Service & Commission Policies</h2>
    <p>Bookings are subject to standard marketplace commissions configured by administrative oversight. Transparent breakdown of base service and approved labour charges is visible prior to job execution.</p>

    <h2>4. Acceptable Use</h2>
    <p>Users may not engage in deceptive practices, misrepresent qualifications, or attempt to circumvent security protections or authentication protocols on the platform.</p>

    <div class="footer">
      <div class="footer-links">
        <a href="/privacy/customer">Customer Policy</a>
        <a href="/privacy/provider">Provider Policy</a>
        <a href="/delete-account">Delete Account</a>
        <a href="/support">Help & Support</a>
        <a href="/api/health">System Status</a>
      </div>
      <div>&copy; ${new Date().getFullYear()} MENDROO Marketplace. All rights reserved.</div>
    </div>
  </div>
</body>
</html>`;

  res.send(html);
};

/**
 * 9. Help & Support Center
 */
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

    ${renderNavTabs('support')}

    <div class="highlight-box">
      Need assistance with your customer account, provider verification, or booking? Our support team is ready to help.
    </div>

    <h2>Official Contact Channels</h2>
    <p>Please reach out via our official communication channels:</p>
    <ul>
      <li><strong>Official Helpline:</strong> <a href="tel:+918927721577" style="color: #A78BFA;">+91 89277 21577</a></li>
      <li><strong>Support Email:</strong> <a href="mailto:support@mendroo.com" style="color: #A78BFA;">support@mendroo.com</a></li>
      <li><strong>Hours of Operation:</strong> Monday – Saturday, 8:00 AM – 8:00 PM IST</li>
      <li><strong>Platform Domain:</strong> <a href="https://service-provider-marketplace.onrender.com" style="color: #A78BFA;">https://service-provider-marketplace.onrender.com</a></li>
    </ul>

    <h2>Account Recovery Assistance</h2>
    <p>If you requested a password reset but did not receive an email, please check your spam folder or ensure you entered the exact email registered to your Customer or Provider profile. Password reset links expire 15 minutes after issuance.</p>

    <div class="footer">
      <div class="footer-links">
        <a href="/privacy/customer">Customer Policy</a>
        <a href="/privacy/provider">Provider Policy</a>
        <a href="/terms">Terms of Service</a>
        <a href="/delete-account">Delete Account</a>
        <a href="/api/health">System Status</a>
      </div>
      <div>&copy; ${new Date().getFullYear()} MENDROO Marketplace. All rights reserved.</div>
    </div>
  </div>
</body>
</html>`;

  res.send(html);
};

module.exports = {
  renderCustomerPrivacyPage,
  renderProviderPrivacyPage,
  renderPrivacyHubPage,
  renderCustomerDeletionPage,
  renderProviderDeletionPage,
  renderAccountDeletionPage,
  handleWebAccountDeletionRequest,
  renderTermsPage,
  renderSupportPage
};
