const crypto = require('crypto');
const readline = require('readline');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/User');
const Admin = require('../models/Admin');
const { hashPassword } = require('../services/authService');
const { connectDB, disconnectDB } = require('../config/db');
const { verifyProductionAdminAccess } = require('./resetAdminPassword');

const EMAIL_REGEX = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;

function promptText(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Generates a cryptographically strong random password (minimum 16 chars, default 20 chars)
 * guaranteeing uppercase, lowercase, numeric, and symbol character classes.
 */
function generateStrongPassword(length = 20) {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*_-+=';
  const all = upper + lower + digits + symbols;

  const pick = (charset) => charset[crypto.randomInt(0, charset.length)];
  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  for (let i = chars.length; i < length; i++) {
    chars.push(pick(all));
  }

  // Fisher-Yates shuffle using crypto.randomInt
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

async function createSuperAdmin() {
  console.log('=== MENDROO PRODUCTION SUPER ADMIN PROVISIONING ===\n');

  if (!process.stdin.isTTY) {
    console.error('Error: This script must be run interactively in your local terminal.');
    process.exit(1);
  }

  const rawEmail = await promptText('Enter NEW Super Admin email address (that you own, NOT admin@gmail.com): ');
  const email = rawEmail.trim().toLowerCase();

  if (!email || !EMAIL_REGEX.test(email)) {
    console.error('Error: Invalid email format (must be a valid email with 2-3 letter TLD, e.g. .com, .in, .org).');
    process.exit(1);
  }

  if (email === 'admin@gmail.com') {
    console.error('Refusing operation: Do not use admin@gmail.com for the new Super Admin account.');
    process.exit(1);
  }

  const nameInput = await promptText('Enter Admin display name [Platform Super Admin]: ');
  const name = nameInput || 'Platform Super Admin';

  const phoneInput = await promptText('Enter unique 10-digit/E.164 phone number (e.g. +9198XXXXXXXX): ');
  const phone = phoneInput.trim();
  if (!phone || phone.length < 10) {
    console.error('Error: A valid unique phone number is required.');
    process.exit(1);
  }

  const connected = await connectDB();
  if (!connected) {
    console.error('Error: Unable to connect to MongoDB. Check MONGODB_URI.');
    process.exit(1);
  }

  try {
    const existingByEmail = await User.findOne({ email }).select('_id role').lean();
    if (existingByEmail) {
      console.error(`Refusing operation: An account with email "${email}" already exists (ID: ${existingByEmail._id}, Role: ${existingByEmail.role}).`);
      process.exit(1);
    }

    const existingByPhone = await User.findOne({ phone }).select('_id').lean();
    if (existingByPhone) {
      console.error(`Refusing operation: Phone number "${phone}" is already associated with another account.`);
      process.exit(1);
    }

    const confirmation = await promptText(`Type "CONFIRM" to create Super Admin "${email}" in production MongoDB: `);
    if (confirmation !== 'CONFIRM') {
      console.log('Aborted: Confirmation did not match. No database changes made.');
      process.exit(0);
    }

    const generatedPassword = generateStrongPassword(20);
    const hashedPassword = await hashPassword(generatedPassword);

    const newUser = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
      role: 'admin',
      isActive: true,
      isVerified: true
    });

    const newAdmin = await Admin.create({
      user: newUser._id,
      permissions: [
        'manage_users',
        'manage_providers',
        'manage_categories',
        'manage_services',
        'manage_bookings',
        'manage_reviews',
        'manage_reports',
        'super_admin'
      ],
      department: 'Executive Operations'
    });

    console.log('\nNew Super Admin account created successfully:');
    console.log(`  Email:     ${newUser.email}`);
    console.log(`  User ID:   ${newUser._id}`);
    console.log(`  Admin ID:  ${newAdmin._id}`);
    console.log(`  Role:      ${newUser.role}`);
    console.log(`  Active:    ${newUser.isActive}`);
    console.log(`  Verified:  ${newUser.isVerified}`);
    console.log('\n===============================================================');
    console.log('SAVE THIS PASSWORD NOW (SHOWN ONLY ONCE IN LOCAL TERMINAL):');
    console.log(`  Password:  ${generatedPassword}`);
    console.log('===============================================================\n');

    await verifyProductionAdminAccess(newUser.email, generatedPassword);
    console.log('\nALL 7 PRODUCTION VERIFICATION CHECKS PASSED. Existing admin@gmail.com account untouched.');
  } finally {
    await disconnectDB();
  }
}

if (require.main === module) {
  createSuperAdmin().catch((err) => {
    console.error('Provisioning failed:', err.message);
    process.exit(1);
  });
}

module.exports = { createSuperAdmin, generateStrongPassword };
