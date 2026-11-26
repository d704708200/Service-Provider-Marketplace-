const https = require('https');
const readline = require('readline');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/User');
const Admin = require('../models/Admin');
const { hashPassword } = require('../services/authService');
const { connectDB, disconnectDB } = require('../config/db');

const PRODUCTION_API_BASE = 'https://service-provider-marketplace.onrender.com/api';

/**
 * Prompt for visible text input via readline.
 */
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
 * Prompt for sensitive password input WITHOUT echoing characters to the terminal.
 */
function promptHidden(question) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      return reject(new Error('Interactive TTY terminal required for hidden password input.'));
    }

    process.stdout.write(question);
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let password = '';

    const cleanup = () => {
      stdin.removeListener('data', onData);
      stdin.setRawMode(Boolean(wasRaw));
      stdin.pause();
    };

    const onData = (ch) => {
      for (const char of ch) {
        if (char === '\r' || char === '\n' || char === '\u0004') {
          cleanup();
          process.stdout.write('\n');
          resolve(password);
          return;
        }
        if (char === '\u0003') {
          // Ctrl+C
          cleanup();
          process.stdout.write('\nCancelled.\n');
          process.exit(130);
        }
        if (char === '\u007f' || char === '\b') {
          if (password.length > 0) {
            password = password.slice(0, -1);
          }
        } else {
          password += char;
        }
      }
    };

    stdin.on('data', onData);
  });
}

function httpsJson(url, method = 'GET', headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = body ? JSON.stringify(body) : null;
    const reqHeaders = { ...headers };
    if (payload) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method,
        headers: reqHeaders
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          let parsed = data;
          try { parsed = JSON.parse(data); } catch {}
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/**
 * Verifies production login and admin dashboard endpoints in memory without logging credentials or tokens.
 */
async function verifyProductionAdminAccess(email, password) {
  console.log('\nVerifying login against production backend...');
  const loginRes = await httpsJson(`${PRODUCTION_API_BASE}/auth/login/admin`, 'POST', {}, { email, password });

  if (loginRes.status !== 200 || !loginRes.body?.success || !loginRes.body?.data?.token) {
    throw new Error(`Production login verification failed (HTTP ${loginRes.status}): ${loginRes.body?.error?.message || loginRes.body?.message || 'Unknown error'}`);
  }

  const token = loginRes.body.data.token;
  console.log(`  [PASS] POST /api/auth/login/admin -> HTTP ${loginRes.status} (JWT issued, role: ${loginRes.body.data.user?.role})`);

  const authHeaders = { Authorization: `Bearer ${token}` };
  const endpoints = [
    { label: 'Auth Session (/auth/me)', path: '/auth/me' },
    { label: 'Wallets (/admin/wallets)', path: '/admin/wallets?limit=1' },
    { label: 'Commissions (/admin/commissions/dashboard)', path: '/admin/commissions/dashboard' },
    { label: 'Bookings (/bookings/admin)', path: '/bookings/admin?limit=1' },
    { label: 'Providers (/providers/admin)', path: '/providers/admin?limit=1' },
    { label: 'Settings (/admin/settings)', path: '/admin/settings' }
  ];

  for (const ep of endpoints) {
    const res = await httpsJson(`${PRODUCTION_API_BASE}${ep.path}`, 'GET', authHeaders);
    const ok = res.status === 200 && res.body?.success === true;
    console.log(`  [${ok ? 'PASS' : 'FAIL'}] GET ${ep.path} -> HTTP ${res.status} (${ep.label})`);
    if (!ok) {
      throw new Error(`Endpoint ${ep.path} returned HTTP ${res.status}`);
    }
  }
}

async function runSecureAdminPasswordReset() {
  console.log('=== MENDROO SECURE ADMIN PASSWORD RESET ===');

  const args = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--')) {
      const [key, ...vals] = arg.slice(2).split('=');
      args[key] = vals.join('=');
    }
  }

  const targetEmail = (args.email || 'admin@gmail.com').trim().toLowerCase();
  const verifyOnly = args['verify-only'] === 'true' || args['verify-only'] === '';

  if (verifyOnly) {
    const password = await promptHidden(`Enter password to verify production login for ${targetEmail}: `);
    await verifyProductionAdminAccess(targetEmail, password);
    return;
  }

  const connected = await connectDB();
  if (!connected) {
    console.error('Error: Unable to connect to MongoDB. Check MONGODB_URI.');
    process.exit(1);
  }

  try {
    const existingUser = await User.findOne({ email: targetEmail });
    if (!existingUser) {
      console.error(`Refusing operation: Admin account "${targetEmail}" does not exist. This tool never creates new admin accounts.`);
      process.exit(1);
    }

    if (existingUser.role !== 'admin' || existingUser.isDeleted) {
      console.error(`Refusing operation: Account "${targetEmail}" is not an active admin role.`);
      process.exit(1);
    }

    const adminProfile = await Admin.findOne({ user: existingUser._id });
    if (!adminProfile) {
      console.error(`Refusing operation: Associated Admin profile missing for "${targetEmail}".`);
      process.exit(1);
    }

    console.log(`Target Admin Verified:`);
    console.log(`  Email:    ${existingUser.email}`);
    console.log(`  User ID:  ${existingUser._id}`);
    console.log(`  Admin ID: ${adminProfile._id}`);
    console.log(`  Role:     ${existingUser.role}`);
    console.log(`  Active:   ${existingUser.isActive}\n`);

    const newPassword = await promptHidden('Enter new Admin password (input hidden, min 8 chars): ');
    if (!newPassword || newPassword.length < 8) {
      console.error('Error: Password must be at least 8 characters long.');
      process.exit(1);
    }

    const confirmPassword = await promptHidden('Confirm new Admin password (input hidden): ');
    if (newPassword !== confirmPassword) {
      console.error('Error: Passwords do not match.');
      process.exit(1);
    }

    const confirmation = await promptText(`Type "CONFIRM" to update password for ${targetEmail}: `);
    if (confirmation !== 'CONFIRM') {
      console.log('Aborted: Confirmation did not match. No changes made.');
      process.exit(0);
    }

    // Update ONLY password hash and passwordChangedAt using existing bcrypt config
    const hashedPassword = await hashPassword(newPassword);
    existingUser.password = hashedPassword;
    existingUser.passwordChangedAt = new Date();
    await existingUser.save();

    console.log(`\nPassword hash securely updated for "${existingUser.email}" (ID, role, profile, permissions, and active status preserved).`);

    await verifyProductionAdminAccess(targetEmail, newPassword);
  } finally {
    await disconnectDB();
  }
}

if (require.main === module) {
  runSecureAdminPasswordReset().catch((err) => {
    console.error('Reset failed:', err.message);
    process.exit(1);
  });
}

module.exports = { runSecureAdminPasswordReset, verifyProductionAdminAccess };
