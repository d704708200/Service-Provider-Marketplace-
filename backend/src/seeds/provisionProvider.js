const readline = require('readline');
const dotenv = require('dotenv');
dotenv.config();

const User = require('../models/User');
const Provider = require('../models/Provider');
const Category = require('../models/Category');
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
 * Safe, Repeatable & Idempotent Service Provider Provisioning Script
 * Reads credentials from:
 * 1. CLI flags: --email=<email> --password=<password> --name=<name> --phone=<phone> --businessName=<name> --category=<catName> --verified=<true|false>
 * 2. Environment variables: PROVIDER_SEED_EMAIL, PROVIDER_SEED_PASSWORD, PROVIDER_SEED_NAME, PROVIDER_SEED_PHONE, PROVIDER_SEED_BUSINESS_NAME, PROVIDER_SEED_VERIFIED
 * 3. Interactive prompt (if stdin is a TTY and missing credentials)
 */
async function provisionProvider() {
  console.log('--- SERVICE PROVIDER PROVISIONING UTILITY ---');

  // Parse command line arguments
  const args = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--')) {
      const [key, ...vals] = arg.slice(2).split('=');
      args[key] = vals.join('=');
    }
  }

  let email = (args.email || process.env.PROVIDER_SEED_EMAIL || '').trim().toLowerCase();
  let password = args.password || process.env.PROVIDER_SEED_PASSWORD || '';
  let name = (args.name || process.env.PROVIDER_SEED_NAME || 'Verified Service Provider').trim();
  let phone = (args.phone || process.env.PROVIDER_SEED_PHONE || '+91 9876500001').trim();
  let businessName = (args.businessName || process.env.PROVIDER_SEED_BUSINESS_NAME || name).trim();
  let categoryName = (args.category || process.env.PROVIDER_SEED_CATEGORY || 'Electrician').trim();
  let experienceYears = parseInt(args.experienceYears || process.env.PROVIDER_SEED_EXPERIENCE || '5', 10);
  
  // Explicit development verification toggle (default to verified for usable dev seeding)
  const isVerifiedArg = args.verified !== undefined 
    ? args.verified === 'true' 
    : (process.env.PROVIDER_SEED_VERIFIED !== undefined ? process.env.PROVIDER_SEED_VERIFIED === 'true' : true);

  // If interactive terminal and credentials are not provided via CLI/ENV
  if ((!email || !password) && process.stdin.isTTY) {
    if (!email) {
      email = (await promptQuestion('Enter provider email: ')).toLowerCase();
    }
    if (!password) {
      password = await promptQuestion('Enter provider password (min 6 chars): ');
    }
  }

  // Validate inputs
  if (!email || !emailRegex.test(email)) {
    console.error('Error: A valid service provider email address is required.');
    console.error('Provide via --email=<email>, PROVIDER_SEED_EMAIL env var, or interactive prompt.');
    process.exit(1);
  }

  if (!password || password.length < 6) {
    console.error('Error: Password is required and must be at least 6 characters.');
    console.error('Provide via --password=<password>, PROVIDER_SEED_PASSWORD env var, or interactive prompt.');
    process.exit(1);
  }

  // Connect to database
  const connected = await connectDB();
  if (!connected) {
    console.error('Error: Cannot connect to MongoDB. Ensure MONGODB_URI is configured and database is reachable.');
    process.exit(1);
  }

  try {
    // Find an active category if available in database
    let category = await Category.findOne({ name: new RegExp(`^${categoryName}$`, 'i'), isActive: true });
    if (!category) {
      category = await Category.findOne({ isActive: true });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      console.log(`Notice: Account "${email}" already exists (User ID: ${existingUser._id}, Role: ${existingUser.role}).`);

      if (existingUser.role !== 'provider') {
        console.error(`Refusing operation: Existing account "${email}" has conflicting role "${existingUser.role}". It cannot be repurposed as provider.`);
        process.exit(1);
      }

      // Check / update password if requested, ensuring bcrypt hash
      const hashedPassword = await hashPassword(password);
      existingUser.password = hashedPassword;
      existingUser.name = name || existingUser.name;
      existingUser.isActive = true;
      await existingUser.save();
      console.log('User password and profile updated successfully with secure bcrypt hash.');

      // Check if Provider profile exists
      let providerProfile = await Provider.findOne({ user: existingUser._id });
      if (!providerProfile) {
        console.log('User has provider role but is missing Provider profile. Creating Provider profile...');
        providerProfile = await Provider.create({
          user: existingUser._id,
          businessName: businessName || existingUser.name,
          bio: 'Professional service provider with verified expertise and commitment to quality.',
          categories: category ? [category._id] : [],
          experienceYears: experienceYears || 5,
          verificationStatus: isVerifiedArg ? 'verified' : 'pending',
          verifiedAt: isVerifiedArg ? new Date() : null,
          isAvailable: true
        });
        console.log(`Provider profile created successfully (Profile ID: ${providerProfile._id}).`);
      } else {
        // Preserve existing ratings, counts, etc. but ensure category and verification status are consistent
        if (category && (!providerProfile.categories || providerProfile.categories.length === 0)) {
          providerProfile.categories = [category._id];
        }
        if (isVerifiedArg && providerProfile.verificationStatus !== 'verified') {
          providerProfile.verificationStatus = 'verified';
          providerProfile.verifiedAt = providerProfile.verifiedAt || new Date();
        }
        providerProfile.isAvailable = true;
        await providerProfile.save();
        console.log(`Provider profile record already exists (Profile ID: ${providerProfile._id}).`);
      }

      console.log('\n--- PROVIDER ACCOUNT DETAILS (EXISTING/UPDATED) ---');
      console.log(`  User ID:             ${existingUser._id}`);
      console.log(`  Name:                ${existingUser.name}`);
      console.log(`  Email:               ${existingUser.email}`);
      console.log(`  Phone:               ${existingUser.phone}`);
      console.log(`  Role:                ${existingUser.role}`);
      console.log(`  Provider Profile ID: ${providerProfile._id}`);
      console.log(`  Business Name:       ${providerProfile.businessName}`);
      console.log(`  Verification Status: ${providerProfile.verificationStatus}`);
      console.log(`  Is Available:        ${providerProfile.isAvailable}`);
      console.log('  Password:            [SECURELY HASHED - NOT EXPOSED]');
      return;
    }

    // Check phone uniqueness against other accounts
    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      console.error(`Refusing operation: Phone number "${phone}" is already associated with user "${existingPhone.email}".`);
      process.exit(1);
    }

    // Hash password securely using existing bcrypt implementation
    const hashedPassword = await hashPassword(password);

    // Create User record with role: 'provider'
    const newUser = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
      role: 'provider',
      isActive: true,
      isVerified: true
    });

    // Create corresponding Provider profile record
    const newProvider = await Provider.create({
      user: newUser._id,
      businessName: businessName || name,
      bio: 'Professional service provider with verified expertise and commitment to quality.',
      categories: category ? [category._id] : [],
      experienceYears: experienceYears || 5,
      verificationStatus: isVerifiedArg ? 'verified' : 'pending',
      verifiedAt: isVerifiedArg ? new Date() : null,
      isAvailable: true
    });

    console.log('\n--- PROVIDER ACCOUNT PROVISIONED SUCCESSFULLY ---');
    console.log(`  User ID:             ${newUser._id}`);
    console.log(`  Name:                ${newUser.name}`);
    console.log(`  Email:               ${newUser.email}`);
    console.log(`  Phone:               ${newUser.phone}`);
    console.log(`  Role:                ${newUser.role}`);
    console.log(`  Provider Profile ID: ${newProvider._id}`);
    console.log(`  Business Name:       ${newProvider.businessName}`);
    console.log(`  Verification Status: ${newProvider.verificationStatus}`);
    console.log(`  Is Available:        ${newProvider.isAvailable}`);
    console.log('  Password:            [SECURELY HASHED - NOT EXPOSED]');
  } finally {
    await disconnectDB();
  }
}

if (require.main === module) {
  provisionProvider().catch((err) => {
    console.error('Provisioning failed:', err.message);
    process.exit(1);
  });
}

module.exports = { provisionProvider };
