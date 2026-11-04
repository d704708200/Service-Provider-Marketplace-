const { spawn } = require('child_process');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '.env') });

const { User, Provider, ProviderWallet, WalletTransaction } = require('./src/models');
const { generateToken } = require('./src/utils/jwt');
const walletService = require('./src/services/walletService');

const ARTIFACTS_DIR = 'C:\\Users\\harsh_33xna20\\.gemini\\antigravity\\brain\\86e881a0-f7df-48de-9b41-4f0b67db9cc4';

// Helper to interact with Chrome via DevTools Protocol
class ChromeCDP {
  constructor(port = 9222) {
    this.port = port;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    // Wait for Chrome to be ready
    let target = null;
    for (let i = 0; i < 20; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${this.port}/json`);
        const targets = await res.json();
        target = targets.find(t => t.type === 'page');
        if (target) break;
      } catch (e) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
    if (!target) throw new Error('No Chrome target page found');

    this.ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const cb = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) cb.reject(new Error(msg.error.message));
        else cb.resolve(msg.result);
      }
    };

    await this.send('Page.enable');
    await this.send('Runtime.enable');
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = this.id++;
      this.callbacks.set(msgId, { resolve, reject });
      this.ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  async navigate(url) {
    await this.send('Page.navigate', { url });
    await new Promise(r => setTimeout(r, 2000));
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', { expression, returnByValue: true });
    return res.result?.value;
  }

  async captureScreenshot(outputPath, clip) {
    const params = { format: 'png' };
    if (clip) params.clip = clip;
    const res = await this.send('Page.captureScreenshot', params);
    const buffer = Buffer.from(res.data, 'base64');
    fs.writeFileSync(outputPath, buffer);
    console.log(`[SCREENSHOT SAVED] ${outputPath} (${buffer.length} bytes)`);
  }

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 600
    });
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function main() {
  console.log('=== STARTING HIGH-FIDELITY SCREENSHOT GENERATION ===');
  await mongoose.connect(process.env.MONGODB_URI);

  // 1. Prepare Staging Admin & Provider credentials & wallet state
  const adminUser = await User.findOne({ role: 'admin' });
  const adminToken = generateToken({ userId: adminUser._id, role: 'admin' });

  let providerUser = await User.findOne({ email: 'raj.electric@marketplace.com' });
  let provider = await Provider.findOne({ user: providerUser._id });

  let wallet = await walletService.getOrCreateWallet(provider._id);
  wallet.availableBalance = 2100;
  wallet.commissionDue = 150;
  wallet.totalEarnings = 3950;
  wallet.totalWithdrawn = 500;
  wallet.pendingWithdrawal = 0;
  await wallet.save();

  // Create representative sample transactions if none exist
  const existingTxns = await WalletTransaction.countDocuments({ provider: provider._id });
  if (existingTxns === 0) {
    await WalletTransaction.create([
      {
        wallet: wallet._id,
        provider: provider._id,
        transactionReference: 'TXN-ADJ-2000-TEST',
        type: 'adjustment_credit',
        amount: 2000,
        balanceBefore: 0,
        balanceAfter: 2000,
        status: 'completed',
        description: 'Test Credit Onboarding'
      },
      {
        wallet: wallet._id,
        provider: provider._id,
        transactionReference: 'TXN-CDUE-150-TEST',
        type: 'CASH_BOOKING_COMMISSION_DUE',
        amount: 150,
        balanceBefore: 2000,
        balanceAfter: 2000,
        commissionDueBefore: 0,
        commissionDueAfter: 150,
        status: 'completed',
        description: 'Commission Due for Cash Booking #BK-9821'
      },
      {
        wallet: wallet._id,
        provider: provider._id,
        transactionReference: 'TXN-ERN-800-TEST',
        type: 'booking_earning',
        amount: 800,
        balanceBefore: 2000,
        balanceAfter: 2800,
        status: 'completed',
        description: 'Online Service Earnings: #BK-7742'
      },
      {
        wallet: wallet._id,
        provider: provider._id,
        transactionReference: 'TXN-WDR-500-TEST',
        type: 'withdrawal',
        amount: 500,
        balanceBefore: 2600,
        balanceAfter: 2100,
        status: 'completed',
        description: 'Payout to UPI: provider@okaxis'
      }
    ]);
  }

  const providerToken = generateToken({ userId: providerUser._id, role: 'provider' });

  // 2. Launch Headless Chrome with remote debugging
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = path.join(process.env.TEMP, 'chrome_cdp_' + Date.now());

  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ]);

  try {
    const cdp = new ChromeCDP(9222);
    await cdp.connect();
    console.log('[CDP] Connected to Chrome DevTools Protocol successfully');

    // -------------------------------------------------------------
    // CAPTURE ADMIN PANEL WALLETS SCREENSHOT
    // -------------------------------------------------------------
    console.log('[CDP] Navigating to Admin Panel...');
    await cdp.setViewport(1366, 850);
    await cdp.navigate('http://localhost:5173');

    // Inject Admin Auth Token
    await cdp.evaluate(`
      localStorage.setItem('admin_token', '${adminToken}');
      localStorage.setItem('admin_user', JSON.stringify(${JSON.stringify({
      id: adminUser._id,
      name: adminUser.name,
      email: adminUser.email,
      role: 'admin'
    })}));
    `);

    // Navigate to Wallets page
    await cdp.navigate('http://localhost:5173/wallets');
    await new Promise(r => setTimeout(r, 2500));

    // Capture Wallets Overview tab
    const adminOverviewPath = path.join(ARTIFACTS_DIR, 'admin_wallets_overview.png');
    await cdp.captureScreenshot(adminOverviewPath);

    // Switch to Tab 3: Commission Payable to Mendroo
    console.log('[CDP] Switching to Commission Payable to Mendroo tab in Admin Panel...');
    await cdp.evaluate(`
      const tabs = Array.from(document.querySelectorAll('button'));
      const commTab = tabs.find(b => b.textContent && b.textContent.includes('Commission Payable to Mendroo'));
      if (commTab) commTab.click();
    `);
    await new Promise(r => setTimeout(r, 1500));

    // Capture Commission Payable Tab
    const adminCommPath = path.join(ARTIFACTS_DIR, 'admin_commission_payable_tab.png');
    await cdp.captureScreenshot(adminCommPath);

    // -------------------------------------------------------------
    // CAPTURE PROVIDER APP WALLET SCREENSHOT
    // -------------------------------------------------------------
    console.log('[CDP] Navigating to Provider App...');
    await cdp.setViewport(412, 915); // Mobile viewport
    await cdp.navigate('http://localhost:8081');

    // Inject Provider Auth Token & Profile
    await cdp.evaluate(`
      localStorage.setItem('@provider_auth_token', '${providerToken}');
      localStorage.setItem('@provider_user_data', JSON.stringify(${JSON.stringify({
      id: providerUser._id,
      name: providerUser.name,
      email: providerUser.email,
      phone: providerUser.phone,
      role: 'provider'
    })}));
      localStorage.setItem('@provider_profile_data', JSON.stringify(${JSON.stringify({
      id: provider._id,
      businessName: provider.businessName,
      phone: provider.phone,
      verificationStatus: 'verified'
    })}));
    `);

    // Set wallet to have ₹150 commission due to showcase Pay Full Commission button
    wallet.commissionDue = 150;
    await wallet.save();

    // Reload with injected session and wait for React Navigation & data fetching
    await cdp.navigate('http://localhost:8081');
    await new Promise(r => setTimeout(r, 3500));

    // Click on Wallet Tab in Bottom Navigation
    console.log('[CDP] Clicking on Wallet tab in Provider App...');
    await cdp.evaluate(`
      const elements = Array.from(document.querySelectorAll('div, button, a, span'));
      const walletNav = elements.find(el => el.textContent && el.textContent.trim() === 'Wallet');
      if (walletNav) walletNav.click();
    `);
    await new Promise(r => setTimeout(r, 2000));

    // Capture Provider Wallet Screen with Due
    const providerWalletWithDuePath = path.join(ARTIFACTS_DIR, 'provider_wallet_with_due.png');
    await cdp.captureScreenshot(providerWalletWithDuePath);

    // Also capture Admin Panel Commission Payable tab with Raj Electric ₹150 due
    await cdp.setViewport(1366, 850);
    await cdp.navigate('http://localhost:5173/wallets');
    await new Promise(r => setTimeout(r, 2000));
    await cdp.evaluate(`
      const tabs = Array.from(document.querySelectorAll('button'));
      const commTab = tabs.find(b => b.textContent && b.textContent.includes('Commission Payable to Mendroo'));
      if (commTab) commTab.click();
    `);
    await new Promise(r => setTimeout(r, 1500));
    const adminCommWithDuePath = path.join(ARTIFACTS_DIR, 'admin_commission_payable_with_due.png');
    await cdp.captureScreenshot(adminCommWithDuePath);

    // Open Settle Full Modal and capture
    console.log('[CDP] Opening Settle Full Modal in Admin Panel...');
    await cdp.evaluate(`
      const buttons = Array.from(document.querySelectorAll('button'));
      const settleBtn = buttons.find(b => b.textContent && b.textContent.includes('Settle Full'));
      if (settleBtn) settleBtn.click();
    `);
    await new Promise(r => setTimeout(r, 1000));
    const adminSettleModalPath = path.join(ARTIFACTS_DIR, 'admin_settle_modal.png');
    await cdp.captureScreenshot(adminSettleModalPath);

    // Close Settle Modal and Open Waive Modal
    await cdp.evaluate(`
      const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.trim() === 'Cancel');
      if (cancelBtn) cancelBtn.click();
    `);
    await new Promise(r => setTimeout(r, 500));
    console.log('[CDP] Opening Waive Full Modal in Admin Panel...');
    await cdp.evaluate(`
      const buttons = Array.from(document.querySelectorAll('button'));
      const waiveBtn = buttons.find(b => b.textContent && b.textContent.includes('Waive Full'));
      if (waiveBtn) waiveBtn.click();
    `);
    await new Promise(r => setTimeout(r, 1000));
    const adminWaiveModalPath = path.join(ARTIFACTS_DIR, 'admin_waive_modal.png');
    await cdp.captureScreenshot(adminWaiveModalPath);

    cdp.close();
  } finally {
    chromeProc.kill();
    await mongoose.disconnect();
    console.log('[CDP] Screenshots generation completed.');
  }
}

main().catch(err => {
  console.error('[SCREENSHOT ERROR]', err);
  process.exit(1);
});
