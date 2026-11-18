const crypto = require('crypto');

const CURRENT_TERMS_VERSION = '2026-11-17';
const TERMS_EFFECTIVE_DATE = '17 November 2026';
const PLATFORM_NAME = 'MENDROO';
const COUNTRY = 'India';

const TERMS_SECTIONS = [
  {
    id: 1,
    title: '1. PROVIDER REGISTRATION',
    clauses: [
      'Providers must submit correct personal details, mobile number and address.',
      'Providers must submit valid identity and verification documents as requested.',
      'All information provided during registration must be genuine and accurate.',
      'Providers must be at least 18 years old.',
      'MENDROO reserves the right to approve or reject any registration.'
    ]
  },
  {
    id: 2,
    title: '2. SERVICE QUALITY & PROFESSIONAL BEHAVIOUR',
    clauses: [
      'Providers must deliver professional and quality services to customers.',
      'Providers must arrive at the customer’s location on time.',
      'Providers must communicate politely and respectfully.',
      'Providers must not use abusive language or behave inappropriately.',
      'Providers must maintain cleanliness and safety while working.',
      'Providers must not demand unauthorized additional charges from customers.'
    ]
  },
  {
    id: 3,
    title: '3. BOOKING & JOB ACCEPTANCE',
    clauses: [
      'Providers can accept or reject service requests according to their availability.',
      'Once a booking is accepted, the provider must complete the assigned service responsibly.',
      'Providers must inform customers about delays or unavoidable cancellations.',
      'Providers must update the booking status in the MENDROO Provider App.',
      'Providers must not mark a job as completed without actually completing the service.'
    ]
  },
  {
    id: 4,
    title: '4. PLATFORM COMMISSION & PAYMENTS',
    clauses: [
      'MENDROO will charge a platform commission on eligible completed bookings.',
      'Commission percentages will be communicated to providers before applicable transactions.',
      'Providers must follow the payment and settlement procedures established by MENDROO.',
      'Cash and online payments must be reported accurately through the platform.',
      'Providers must not hide, manipulate or misreport booking amounts.',
      'Applicable platform charges and settlements will be handled according to the agreed payment policy.'
    ]
  },
  {
    id: 5,
    title: '5. STRICT NO-BYPASS POLICY',
    clauses: [
      'Providers must not encourage customers to cancel MENDROO bookings to complete the same service privately and avoid platform commission.',
      'Providers must not misuse customer contact details obtained through MENDROO.',
      'Providers must not redirect platform customers to personal business channels to avoid platform charges.',
      'All bookings generated through MENDROO must follow the applicable platform booking and payment policies.',
      'Violations may result in account suspension, termination or recovery of legitimate outstanding dues, subject to applicable law.'
    ]
  },
  {
    id: 6,
    title: '6. PARTS & MATERIALS POLICY',
    clauses: [
      'Providers must inform customers about the cost of spare parts and materials before purchasing.',
      'Original bills or invoices must be provided wherever applicable.',
      'Providers must not charge customers more than the agreed amount without approval.',
      'Any parts purchased on behalf of customers must be properly reported.',
      'MENDROO may establish separate commission rules for labour charges and parts transactions.'
    ]
  },
  {
    id: 7,
    title: '7. CUSTOMER PRIVACY & DATA PROTECTION',
    clauses: [
      'Providers must keep customer information confidential.',
      'Customer phone numbers, addresses and personal details must not be shared with third parties.',
      'Providers must not use customer information for personal marketing without proper consent.',
      'Taking or sharing customer photographs, videos or personal information without permission is prohibited.'
    ]
  },
  {
    id: 8,
    title: '8. CANCELLATION & MISCONDUCT',
    clauses: [
      'Repeated cancellations after accepting bookings may affect provider performance.',
      'Fake bookings, fraudulent activities and false job completion reports are prohibited.',
      'Providers must not ask customers for unauthorized payments.',
      'Any customer complaint or dispute must be handled professionally.',
      'Serious misconduct may lead to temporary suspension or permanent account termination.'
    ]
  },
  {
    id: 9,
    title: '9. RATINGS & CUSTOMER FEEDBACK',
    clauses: [
      'Customers may rate and review services.',
      'Providers must not force customers to give positive ratings.',
      'Fake reviews, manipulated ratings and fraudulent feedback are prohibited.',
      'MENDROO may review complaints and investigate service-related issues.'
    ]
  },
  {
    id: 10,
    title: '10. ACCOUNT SUSPENSION & TERMINATION',
    intro: 'MENDROO reserves the right to restrict, suspend or terminate a provider account in cases involving:',
    bullets: [
      'Fraud or false documentation.',
      'Repeated customer complaints.',
      'Commission evasion or platform bypass.',
      'Misconduct or harassment.',
      'Unauthorized charges.',
      'Violation of platform policies.'
    ],
    closing: 'Where appropriate, providers will be given an opportunity to respond before action is taken.'
  },
  {
    id: 11,
    title: '11. INDEPENDENT SERVICE PROVIDER',
    clauses: [
      'Providers operate as independent service professionals.',
      'Registration on MENDROO does not automatically create an employer-employee relationship.',
      'Providers are responsible for their applicable licences, qualifications, taxes and legal compliance.',
      'Providers are responsible for the quality and safety of their own work.'
    ]
  },
  {
    id: 12,
    title: '12. LIABILITY & RESPONSIBILITY',
    clauses: [
      'Providers are responsible for performing services with reasonable skill and care.',
      'Providers must follow applicable safety standards and legal requirements.',
      'MENDROO acts as a platform connecting customers and service providers.',
      'MENDROO does not guarantee a minimum number of bookings or income.',
      'Nothing in these terms excludes liability that cannot legally be excluded under applicable law.'
    ]
  },
  {
    id: 13,
    title: '13. POLICY UPDATES',
    text: 'MENDROO reserves the right to update these Terms & Conditions when required. Providers will be informed of material changes through the app or other official communication channels.'
  },
  {
    id: 14,
    title: '14. GOVERNING LAW & DISPUTES',
    text: 'These Terms & Conditions shall be governed by the laws of India. Disputes shall be handled by the competent courts having jurisdiction, subject to applicable law.'
  },
  {
    id: 15,
    title: '15. PROVIDER DECLARATION & ACCEPTANCE',
    intro: 'By clicking on the “I AGREE & ACCEPT” button, I confirm that:',
    bullets: [
      'I have read and understood all Terms & Conditions.',
      'I agree to follow MENDROO’s service and payment policies.',
      'I agree to the platform commission rules communicated to me.',
      'I will not bypass the MENDROO platform for its bookings.',
      'I will provide honest, safe and professional services to customers.'
    ],
    tagline: 'MENDROO – Your Service, Our Platform.',
    footer: 'Official Platform: MENDROO\nCountry: India'
  }
];

const RAW_TERMS_TEXT = `# MENDROO
# TERMS & CONDITIONS FOR SERVICE PROVIDERS

Effective Date: 17 November 2026

Welcome to MENDROO! By registering as a Service Provider on the MENDROO platform, you agree to follow the terms and conditions mentioned below.

### 1. PROVIDER REGISTRATION

1. Providers must submit correct personal details, mobile number and address.
2. Providers must submit valid identity and verification documents as requested.
3. All information provided during registration must be genuine and accurate.
4. Providers must be at least 18 years old.
5. MENDROO reserves the right to approve or reject any registration.

### 2. SERVICE QUALITY & PROFESSIONAL BEHAVIOUR

1. Providers must deliver professional and quality services to customers.
2. Providers must arrive at the customer’s location on time.
3. Providers must communicate politely and respectfully.
4. Providers must not use abusive language or behave inappropriately.
5. Providers must maintain cleanliness and safety while working.
6. Providers must not demand unauthorized additional charges from customers.

### 3. BOOKING & JOB ACCEPTANCE

1. Providers can accept or reject service requests according to their availability.
2. Once a booking is accepted, the provider must complete the assigned service responsibly.
3. Providers must inform customers about delays or unavoidable cancellations.
4. Providers must update the booking status in the MENDROO Provider App.
5. Providers must not mark a job as completed without actually completing the service.

### 4. PLATFORM COMMISSION & PAYMENTS

1. MENDROO will charge a platform commission on eligible completed bookings.
2. Commission percentages will be communicated to providers before applicable transactions.
3. Providers must follow the payment and settlement procedures established by MENDROO.
4. Cash and online payments must be reported accurately through the platform.
5. Providers must not hide, manipulate or misreport booking amounts.
6. Applicable platform charges and settlements will be handled according to the agreed payment policy.

### 5. STRICT NO-BYPASS POLICY

1. Providers must not encourage customers to cancel MENDROO bookings to complete the same service privately and avoid platform commission.
2. Providers must not misuse customer contact details obtained through MENDROO.
3. Providers must not redirect platform customers to personal business channels to avoid platform charges.
4. All bookings generated through MENDROO must follow the applicable platform booking and payment policies.
5. Violations may result in account suspension, termination or recovery of legitimate outstanding dues, subject to applicable law.

### 6. PARTS & MATERIALS POLICY

1. Providers must inform customers about the cost of spare parts and materials before purchasing.
2. Original bills or invoices must be provided wherever applicable.
3. Providers must not charge customers more than the agreed amount without approval.
4. Any parts purchased on behalf of customers must be properly reported.
5. MENDROO may establish separate commission rules for labour charges and parts transactions.

### 7. CUSTOMER PRIVACY & DATA PROTECTION

1. Providers must keep customer information confidential.
2. Customer phone numbers, addresses and personal details must not be shared with third parties.
3. Providers must not use customer information for personal marketing without proper consent.
4. Taking or sharing customer photographs, videos or personal information without permission is prohibited.

### 8. CANCELLATION & MISCONDUCT

1. Repeated cancellations after accepting bookings may affect provider performance.
2. Fake bookings, fraudulent activities and false job completion reports are prohibited.
3. Providers must not ask customers for unauthorized payments.
4. Any customer complaint or dispute must be handled professionally.
5. Serious misconduct may lead to temporary suspension or permanent account termination.

### 9. RATINGS & CUSTOMER FEEDBACK

1. Customers may rate and review services.
2. Providers must not force customers to give positive ratings.
3. Fake reviews, manipulated ratings and fraudulent feedback are prohibited.
4. MENDROO may review complaints and investigate service-related issues.

### 10. ACCOUNT SUSPENSION & TERMINATION

MENDROO reserves the right to restrict, suspend or terminate a provider account in cases involving:

- Fraud or false documentation.
- Repeated customer complaints.
- Commission evasion or platform bypass.
- Misconduct or harassment.
- Unauthorized charges.
- Violation of platform policies.

Where appropriate, providers will be given an opportunity to respond before action is taken.

### 11. INDEPENDENT SERVICE PROVIDER

1. Providers operate as independent service professionals.
2. Registration on MENDROO does not automatically create an employer-employee relationship.
3. Providers are responsible for their applicable licences, qualifications, taxes and legal compliance.
4. Providers are responsible for the quality and safety of their own work.

### 12. LIABILITY & RESPONSIBILITY

1. Providers are responsible for performing services with reasonable skill and care.
2. Providers must follow applicable safety standards and legal requirements.
3. MENDROO acts as a platform connecting customers and service providers.
4. MENDROO does not guarantee a minimum number of bookings or income.
5. Nothing in these terms excludes liability that cannot legally be excluded under applicable law.

### 13. POLICY UPDATES

MENDROO reserves the right to update these Terms & Conditions when required. Providers will be informed of material changes through the app or other official communication channels.

### 14. GOVERNING LAW & DISPUTES

These Terms & Conditions shall be governed by the laws of India. Disputes shall be handled by the competent courts having jurisdiction, subject to applicable law.

### 15. PROVIDER DECLARATION & ACCEPTANCE

By clicking on the “I AGREE & ACCEPT” button, I confirm that:

- I have read and understood all Terms & Conditions.
- I agree to follow MENDROO’s service and payment policies.
- I agree to the platform commission rules communicated to me.
- I will not bypass the MENDROO platform for its bookings.
- I will provide honest, safe and professional services to customers.

MENDROO – Your Service, Our Platform.

Official Platform: MENDROO
Country: India`;

const TERMS_HASH = crypto
  .createHash('sha256')
  .update(RAW_TERMS_TEXT.replace(/\r\n/g, '\n').trim(), 'utf8')
  .digest('hex');

module.exports = {
  CURRENT_TERMS_VERSION,
  TERMS_EFFECTIVE_DATE,
  PLATFORM_NAME,
  COUNTRY,
  TERMS_SECTIONS,
  RAW_TERMS_TEXT,
  TERMS_HASH
};
