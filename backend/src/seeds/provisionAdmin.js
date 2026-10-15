const readline = require('readline');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
dotenv.config();

const User = require('../models/User');
const Admin = require('../models/Admin');
const { hashPassword } = require('../services/authService');
const { connectDB, disconnectDB } = require('../config/db');

const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;

function promptQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Safe Administrator Provisioning Script
 * Reads credentials from:
 * 1. CLI flags: --email=<email> --password=<password> --name=<name> --phone=<phone>
 * 2. Environment variables: ADMIN_SEED_EMAIL, ADMIN_SEED_PASSWORD, ADMIN_SEED_NAME, ADMIN_SEED_PHONE
 * 3. Interactive prompt (if stdin is a TTY and missing arguments)
 */
async function provisionAdmin() {
  console.log('--- ADMINISTRATIVE PROVISIONING UTILITY ---');

  // Parse command line arguments
  const args = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--')) {
      const [key, ...vals] = arg.slice(2).split('=');
      args[key] = vals.join('=');
    }
  }

  let email = (args.email || process.env.ADMIN_SEED_EMAIL || '').trim().toLowerCase();
  let password = args.password || process.env.ADMIN_SEED_PASSWORD || '';
  let name = (args.name || process.env.ADMIN_SEED_NAME || 'Platform Administrator').trim();
  let phone = (args.phone || process.env.ADMIN_SEED_PHONE || '+10000000000').trim();
  let department = (args.department || process.env.ADMIN_SEED_DEPARTMENT || 'Operations').trim();

  // If interactive terminal and credentials are not provided via CLI/ENV
  if ((!email || !password) && process.stdin.isTTY) {
    if (!email) {
      email = (await promptQuestion('Enter administrator email: ')).toLowerCase();
    }
    if (!password) {
      password = await promptQuestion('Enter administrator initial password (min 6 chars): ');
    }
  }

  // Validate inputs
  if (!email || !emailRegex.test(email)) {
    console.error('Error: A valid administrator email address is required.');
    console.error('Provide via --email=<email>, ADMIN_SEED_EMAIL env var, or interactive prompt.');
    process.exit(1);
  }

  if (!password || password.length < 6) {
    console.error('Error: Password is required and must be at least 6 characters.');
    console.error('Provide via --password=<password>, ADMIN_SEED_PASSWORD env var, or interactive prompt.');
    process.exit(1);
  }

  // Connect to database
  const connected = await connectDB();
  if (!connected) {
    console.error('Error: Cannot connect to MongoDB. Ensure MONGODB_URI is configured and database is reachable.');
    process.exit(1);
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log(`Notice: User record for "${email}" already exists (User ID: ${existingUser._id}, Role: ${existingUser.role}).`);
      
      if (existingUser.role !== 'admin') {
        console.error(`Refusing operation: Existing account "${email}" has conflicting role "${existingUser.role}". It cannot be repurposed as admin.`);
        process.exit(1);
      }

      // Check if Admin profile exists
      let adminProfile = await Admin.findOne({ user: existingUser._id });
      if (!adminProfile) {
        console.log('User has admin role but is missing an associated Admin profile. Creating Admin profile...');
        adminProfile = await Admin.create({
          user: existingUser._id,
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
          department: department || 'Operations'
        });
        console.log(`Admin profile created successfully (Profile ID: ${adminProfile._id}).`);
      }

      const shouldReset = args['reset-password'] === 'true' || args['reset-password'] === '' || process.env.ADMIN_RESET_PASSWORD === 'true';
      if (shouldReset) {
        const hashedPassword = await hashPassword(password);
        existingUser.password = hashedPassword;
        existingUser.isActive = true;
        existingUser.isVerified = true;
        await existingUser.save();
        console.log(`Administrator password has been securely updated for "${email}".`);
      } else {
        console.log(`Admin record exists (User ID: ${existingUser._id}, Profile ID: ${adminProfile._id}). Existing password preserved. (To reset, pass --reset-password).`);
      }

      return;
    }

    // Check phone uniqueness
    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      console.error(`Refusing operation: Phone number "${phone}" is already associated with another account.`);
      process.exit(1);
    }

    // Hash password securely using existing bcrypt implementation
    const hashedPassword = await hashPassword(password);

    // Create User record with role: 'admin'
    const newUser = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
      role: 'admin',
      isActive: true,
      isVerified: true
    });

    // Create corresponding Admin profile record
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
      department
    });

    console.log('Administrator account successfully provisioned:');
    console.log(`  User ID:    ${newUser._id}`);
    console.log(`  Email:      ${newUser.email}`);
    console.log(`  Role:       ${newUser.role}`);
    console.log(`  Admin ID:   ${newAdmin._id}`);
    console.log(`  Department: ${newAdmin.department}`);
    console.log('  Password:   [SECURELY HASHED - NOT EXPOSED]');
  } finally {
    await disconnectDB();
  }
}

if (require.main === module) {
  provisionAdmin().catch((err) => {
    console.error('Provisioning failed:', err.message);
    process.exit(1);
  });
}

module.exports = { provisionAdmin };
