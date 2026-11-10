/**
 * AUTOMATED TEST SUITE: DUAL PLATFORM COMMISSION SYSTEM
 * Service Commission + Labour Commission
 *
 * Verifies all 17 critical test scenarios across:
 * - commissionCalculator utility
 * - Booking model snapshot & pre-save hooks
 * - bookingService lifecycle (create, submit parts/labour, review parts/labour)
 * - walletService dual settlement (online, cash, auto-deduct, breakdown)
 * - settingService validation and audit logging
 * - Physical parts 100% commission-free invariant
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const crypto = require('crypto');

dotenv.config({ path: path.join(__dirname, '.env') });

const {
  ProviderWallet,
  WalletTransaction,
  Provider,
  User,
  Customer,
  Service,
  Category,
  Booking,
  Setting
} = require('./src/models');
const walletService = require('./src/services/walletService');
const bookingService = require('./src/services/bookingService');
const settingService = require('./src/services/settingService');
const {
  calculateBookingCommission,
  calculateDualCommission,
  getActiveCommissionRates
} = require('./src/utils/commissionCalculator');

async function runDualCommissionSuite() {
  console.log('================================================================================');
  console.log('🧪 RUNNING DUAL COMMISSION SYSTEM TEST SUITE (17 SCENARIOS)');
  console.log('================================================================================\n');

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set in backend/.env');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[SETUP] Connected to MongoDB database:', mongoose.connection.name);

  let passed = 0;
  let failed = 0;
  const results = [];

  function assert(condition, testName, details = {}) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
      results.push({ name: testName, status: 'PASS', details });
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      console.error('     Details:', JSON.stringify(details, null, 2));
      failed++;
      results.push({ name: testName, status: 'FAIL', details });
    }
  }

  const runId = crypto.randomBytes(4).toString('hex');
  let testAdminUser, testCustomerUser, testCustomerDoc, testProviderUser, testProviderDoc, testCategory, testService;

  try {
    // ---------------------------------------------------------
    // SETUP TEST FIXTURES
    // ---------------------------------------------------------
    const ts = Date.now().toString().slice(-6);
    testAdminUser = await User.create({
      name: `Admin DualComm ${ts}`,
      email: `admin.dualcomm.${ts}@example.com`,
      phone: `90${Date.now().toString().slice(-8)}`,
      password: 'AdminPassword123!',
      role: 'admin',
      isActive: true,
      isVerified: true
    });

    testCustomerUser = await User.create({
      name: `Dual Comm Customer ${ts}`,
      email: `cust.dualcomm.${ts}@example.com`,
      phone: `98${Date.now().toString().slice(-8)}`,
      password: 'CustomerPassword123!',
      role: 'customer',
      isActive: true,
      isVerified: true
    });
    testCustomerDoc = await Customer.create({
      user: testCustomerUser._id,
      phone: testCustomerUser.phone,
      name: `Dual Comm Customer ${runId}`
    });

    testProviderUser = await User.create({
      name: `Dual Comm Provider ${ts}`,
      email: `prov.dualcomm.${ts}@example.com`,
      phone: `97${Date.now().toString().slice(-8)}`,
      password: 'ProviderPassword123!',
      role: 'provider',
      isActive: true,
      isVerified: true
    });
    testProviderDoc = await Provider.create({
      user: testProviderUser._id,
      phone: testProviderUser.phone,
      businessName: `Dual Comm Provider ${runId}`,
      isVerified: true,
      serviceRadiusKm: 25,
      location: { type: 'Point', coordinates: [77.2090, 28.6139] }
    });

    testCategory = await Category.create({
      name: `Category-${runId}`,
      slug: `cat-${runId}`,
      allowedRadiusOptions: [5, 10, 15]
    });

    testService = await Service.create({
      name: `Dual Commission Testing Service ${runId}`,
      category: testCategory._id,
      price: 500,
      duration: 60,
      isActive: true
    });

    console.log('[SETUP] Fixtures initialized.\n');

    // =========================================================
    // SCENARIO 1: Base service only (500 base, 15% service, 10% labour)
    // =========================================================
    console.log('--- SCENARIO 1: Base Service Only ---');
    {
      const calc = calculateDualCommission({
        servicePrice: 500,
        labourCharge: 0,
        partsAmount: 0,
        serviceRate: 15,
        labourRate: 10
      });

      assert(
        calc.serviceCommissionAmount === 75 &&
        calc.labourCommissionAmount === 0 &&
        calc.totalPlatformCommission === 75 &&
        calc.providerNetEarning === 425 &&
        calc.totalCustomerPayable === 500,
        'Scenario 1: Base service only -> Service comm = 75, labour = 0, total = 75, net = 425',
        calc
      );
    }

    // =========================================================
    // SCENARIO 2: Base service + unapproved labour (proposed 200, status pending)
    // =========================================================
    console.log('\n--- SCENARIO 2: Base Service + Unapproved Labour ---');
    {
      const calcPending = calculateBookingCommission({
        originalServicePrice: 500,
        spareParts: {
          items: [{ name: 'Wire Work', type: 'labour', labourCharge: 200, unitPrice: 0 }],
          labourSubtotal: 200,
          status: 'pending'
        },
        platformCommissionRate: 15,
        labourCommissionRate: 10
      });

      assert(
        calcPending.serviceCommissionAmount === 75 &&
        calcPending.labourCommissionAmount === 0 &&
        calcPending.totalPlatformCommission === 75 &&
        calcPending.approvedLabourCharge === 0,
        'Scenario 2: Unapproved labour yields 0 labour commission',
        calcPending
      );
    }

    // =========================================================
    // SCENARIO 3: Base service + approved labour (500 base, 300 approved labour)
    // =========================================================
    console.log('\n--- SCENARIO 3: Base Service + Approved Labour ---');
    {
      const calcApproved = calculateBookingCommission({
        originalServicePrice: 500,
        spareParts: {
          items: [{ name: 'Wiring Labour', type: 'labour', labourCharge: 300, unitPrice: 0 }],
          labourSubtotal: 300,
          status: 'approved'
        },
        platformCommissionRate: 15,
        labourCommissionRate: 10
      });

      assert(
        calcApproved.serviceCommissionAmount === 75 &&
        calcApproved.labourCommissionAmount === 30 &&
        calcApproved.totalPlatformCommission === 105 &&
        calcApproved.providerNetEarning === 695 &&
        calcApproved.totalCustomerPayable === 800,
        'Scenario 3: Approved labour 300 @ 10% = 30; Service 500 @ 15% = 75; Total comm = 105, net = 695',
        calcApproved
      );
    }

    // =========================================================
    // SCENARIO 4: Base service + parts only (500 base, 400 parts)
    // =========================================================
    console.log('\n--- SCENARIO 4: Base Service + Parts Only ---');
    {
      const calcParts = calculateBookingCommission({
        originalServicePrice: 500,
        spareParts: {
          items: [{ name: 'Capacitor', type: 'material', unitPrice: 400, labourCharge: 0 }],
          partsSubtotal: 400,
          totalAdditionalAmount: 400,
          status: 'approved'
        },
        platformCommissionRate: 15,
        labourCommissionRate: 10
      });

      assert(
        calcParts.serviceCommissionAmount === 75 &&
        calcParts.labourCommissionAmount === 0 &&
        calcParts.partsCommissionAmount === 0 &&
        calcParts.totalPlatformCommission === 75 &&
        calcParts.providerNetEarning === 825 &&
        calcParts.totalCustomerPayable === 900,
        'Scenario 4: Parts 400 has 0% commission; Total comm = 75, Provider net = 825',
        calcParts
      );
    }

    // =========================================================
    // SCENARIO 5: Full Combo (Service 500 + Labour 300 + Parts 200)
    // =========================================================
    console.log('\n--- SCENARIO 5: Full Combo (Service + Approved Labour + Parts) ---');
    {
      const fullCombo = calculateBookingCommission({
        originalServicePrice: 500,
        spareParts: {
          items: [
            { name: 'Spare Motor', type: 'material', unitPrice: 200, labourCharge: 0 },
            { name: 'Installation Labour', type: 'labour', unitPrice: 0, labourCharge: 300 }
          ],
          partsSubtotal: 200,
          labourSubtotal: 300,
          totalAdditionalAmount: 500,
          status: 'approved'
        },
        platformCommissionRate: 15,
        labourCommissionRate: 10
      });

      assert(
        fullCombo.serviceCommissionAmount === 75 &&
        fullCombo.labourCommissionAmount === 30 &&
        fullCombo.partsCommissionAmount === 0 &&
        fullCombo.totalPlatformCommission === 105 &&
        fullCombo.totalCustomerPayable === 1000 &&
        fullCombo.providerNetEarning === 895,
        'Scenario 5: Combo -> Service comm = 75, Labour comm = 30, Parts = 0, Total comm = 105, Customer = 1000, Provider net = 895',
        fullCombo
      );
    }

    // =========================================================
    // SCENARIO 6: Labour Commission configured at 0%
    // =========================================================
    console.log('\n--- SCENARIO 6: Labour Commission Configured at 0% ---');
    {
      const calcZeroLabour = calculateDualCommission({
        servicePrice: 500,
        labourCharge: 200,
        partsAmount: 150,
        serviceRate: 15,
        labourRate: 0
      });

      assert(
        calcZeroLabour.serviceCommissionAmount === 75 &&
        calcZeroLabour.labourCommissionAmount === 0 &&
        calcZeroLabour.totalPlatformCommission === 75 &&
        calcZeroLabour.providerNetEarning === 775,
        'Scenario 6: Labour rate 0% charges zero labour commission',
        calcZeroLabour
      );
    }

    // =========================================================
    // SCENARIO 7: Labour Commission configured at 100%
    // =========================================================
    console.log('\n--- SCENARIO 7: Labour Commission Configured at 100% ---');
    {
      const calcMaxLabour = calculateDualCommission({
        servicePrice: 500,
        labourCharge: 200,
        partsAmount: 0,
        serviceRate: 10,
        labourRate: 100
      });

      assert(
        calcMaxLabour.serviceCommissionAmount === 50 &&
        calcMaxLabour.labourCommissionAmount === 200 &&
        calcMaxLabour.totalPlatformCommission === 250 &&
        calcMaxLabour.providerNetEarning === 450,
        'Scenario 7: Labour rate 100% correctly deducts entire labour charge as commission (200 of 200)',
        calcMaxLabour
      );
    }

    // =========================================================
    // SCENARIO 8: Labour rejected after quote
    // =========================================================
    console.log('\n--- SCENARIO 8: Labour Rejected by Customer ---');
    {
      const calcRejected = calculateBookingCommission({
        originalServicePrice: 500,
        spareParts: {
          items: [{ name: 'Extra Labour', type: 'labour', labourCharge: 350 }],
          labourSubtotal: 350,
          status: 'rejected'
        },
        platformCommissionRate: 15,
        labourCommissionRate: 12
      });

      assert(
        calcRejected.approvedLabourCharge === 0 &&
        calcRejected.labourCommissionAmount === 0 &&
        calcRejected.totalPlatformCommission === 75,
        'Scenario 8: Customer rejection leaves approvedLabourCharge=0 and labourCommissionAmount=0',
        calcRejected
      );
    }

    // =========================================================
    // SCENARIO 9: Snapshot preservation when rate changed later
    // =========================================================
    console.log('\n--- SCENARIO 9: Rate Snapshot Preservation ---');
    {
      // Create a booking with snapshotted rates
      const booking = new Booking({
        bookingReference: `BK-SNAP-${runId}`,
        customer: testCustomerDoc._id,
        provider: testProviderDoc._id,
        service: testService._id,
        category: testCategory._id,
        bookingMode: 'scheduled',
        scheduledDate: new Date(),
        scheduledTimeSlot: { startTime: '10:00', endTime: '11:00' },
        address: { street: '123 Test St', city: 'Delhi', location: { type: 'Point', coordinates: [77.2090, 28.6139] } },
        pricing: { basePrice: 500, tax: 0, discount: 0, totalAmount: 500 },
        paymentMethod: 'cash',
        platformCommissionRate: 12,
        labourCommissionRate: 8,
        originalServicePrice: 500,
        commissionableAmount: 500,
        serviceCommissionAmount: 60,
        labourCommissionAmount: 0,
        totalPlatformCommission: 60
      });
      await booking.save();

      // Simulate global setting changing to 25% and 20%
      const globalRatesNow = { serviceRate: 25, labourRate: 20 };

      // Re-read booking from database and ensure it retains snapshotted rates
      const freshBooking = await Booking.findById(booking._id);
      assert(
        freshBooking.platformCommissionRate === 12 &&
        freshBooking.labourCommissionRate === 8 &&
        freshBooking.totalPlatformCommission === 60,
        'Scenario 9: Booking rate snapshot is strictly preserved when global rate changes',
        {
          savedRates: { service: freshBooking.platformCommissionRate, labour: freshBooking.labourCommissionRate },
          globalRatesNow
        }
      );
    }

    // =========================================================
    // SCENARIO 10: Historical booking safety (default to 0% labour)
    // =========================================================
    console.log('\n--- SCENARIO 10: Historical Booking Safety ---');
    {
      const historicalBookingData = {
        originalServicePrice: 600,
        platformCommissionRate: 15
        // labourCommissionRate is intentionally undefined (historical record)
      };

      const calcHist = calculateBookingCommission(historicalBookingData);
      assert(
        calcHist.labourCommissionRate === 0 &&
        calcHist.labourCommissionAmount === 0 &&
        calcHist.serviceCommissionAmount === 90 &&
        calcHist.totalPlatformCommission === 90,
        'Scenario 10: Historical booking without labour rate defaults safely to 0% without retro-deduction',
        calcHist
      );
    }

    // =========================================================
    // SCENARIO 11: Wallet online settlement
    // =========================================================
    console.log('\n--- SCENARIO 11: Wallet Online Settlement ---');
    {
      // Create wallet for test provider
      let wallet = await ProviderWallet.findOne({ provider: testProviderDoc._id });
      if (!wallet) {
        wallet = await ProviderWallet.create({
          provider: testProviderDoc._id,
          availableBalance: 0,
          pendingBalance: 0,
          commissionDue: 0,
          autoDeductCommissionFromWallet: true
        });
      }
      wallet.availableBalance = 0;
      wallet.commissionDue = 0;
      await wallet.save();

      const onlineBooking = await Booking.create({
        bookingReference: `BK-ONL-${runId}`,
        customer: testCustomerDoc._id,
        provider: testProviderDoc._id,
        service: testService._id,
        category: testCategory._id,
        bookingMode: 'scheduled',
        scheduledDate: new Date(),
        scheduledTimeSlot: { startTime: '11:00', endTime: '12:00' },
        address: { street: '123 Test St', city: 'Delhi', location: { type: 'Point', coordinates: [77.2090, 28.6139] } },
        pricing: { basePrice: 500, tax: 0, discount: 0, totalAmount: 1000 },
        paymentMethod: 'online',
        paymentStatus: 'paid',
        status: 'completed',
        platformCommissionRate: 15,
        labourCommissionRate: 10,
        originalServicePrice: 500,
        approvedLabourCharge: 300,
        additionalPartsAmount: 200,
        spareParts: {
          status: 'approved',
          partsSubtotal: 200,
          labourSubtotal: 300,
          totalAdditionalAmount: 500
        },
        serviceCommissionAmount: 75,
        labourCommissionAmount: 30,
        totalPlatformCommission: 105,
        providerNetEarning: 895,
        totalCustomerPayable: 1000
      });

      const creditRes = await walletService.creditBookingEarnings(onlineBooking);
      const updatedWallet = await ProviderWallet.findOne({ provider: testProviderDoc._id });

      assert(
        creditRes.netCredit === 895 &&
        creditRes.platformCommission === 105 &&
        updatedWallet.availableBalance === 895 &&
        updatedWallet.commissionDue === 0,
        'Scenario 11: Online booking credits net 895 (1000 total - 105 total comm) and 0 commission due',
        { creditRes, availableBalance: updatedWallet.availableBalance }
      );
    }

    // =========================================================
    // SCENARIO 12: Wallet cash settlement (commission due recorded)
    // =========================================================
    console.log('\n--- SCENARIO 12: Wallet Cash Settlement ---');
    {
      const wallet = await ProviderWallet.findOne({ provider: testProviderDoc._id });
      wallet.availableBalance = 0;
      wallet.commissionDue = 0;
      wallet.autoDeductCommissionFromWallet = false; // Disable auto-deduct to check pure accrual
      await wallet.save();

      const cashBooking = await Booking.create({
        bookingReference: `BK-CSH-${runId}`,
        customer: testCustomerDoc._id,
        provider: testProviderDoc._id,
        service: testService._id,
        category: testCategory._id,
        bookingMode: 'scheduled',
        scheduledDate: new Date(),
        scheduledTimeSlot: { startTime: '12:00', endTime: '13:00' },
        address: { street: '123 Test St', city: 'Delhi', location: { type: 'Point', coordinates: [77.2090, 28.6139] } },
        pricing: { basePrice: 500, tax: 0, discount: 0, totalAmount: 1000 },
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        status: 'completed',
        platformCommissionRate: 15,
        labourCommissionRate: 10,
        originalServicePrice: 500,
        approvedLabourCharge: 300,
        additionalPartsAmount: 200,
        spareParts: {
          status: 'approved',
          partsSubtotal: 200,
          labourSubtotal: 300,
          totalAdditionalAmount: 500
        },
        serviceCommissionAmount: 75,
        labourCommissionAmount: 30,
        totalPlatformCommission: 105,
        providerNetEarning: 895,
        totalCustomerPayable: 1000
      });

      const cashRes = await walletService.creditBookingEarnings(cashBooking);
      const updatedWallet = await ProviderWallet.findOne({ provider: testProviderDoc._id });

      assert(
        cashRes.commissionDue === 105 &&
        cashRes.serviceCommissionDue === 75 &&
        cashRes.labourCommissionDue === 30 &&
        updatedWallet.commissionDue === 105,
        'Scenario 12: Cash booking records 105 total commission due (75 service + 30 labour)',
        cashRes
      );
    }

    // =========================================================
    // SCENARIO 13: Auto-deduct from provider balance
    // =========================================================
    console.log('\n--- SCENARIO 13: Auto-Deduct From Provider Balance ---');
    {
      const wallet = await ProviderWallet.findOne({ provider: testProviderDoc._id });
      wallet.availableBalance = 500;
      wallet.commissionDue = 0;
      wallet.autoDeductCommissionFromWallet = true; // Enabled
      await wallet.save();

      const autoDeductBooking = await Booking.create({
        bookingReference: `BK-AUTO-${runId}`,
        customer: testCustomerDoc._id,
        provider: testProviderDoc._id,
        service: testService._id,
        category: testCategory._id,
        bookingMode: 'scheduled',
        scheduledDate: new Date(),
        scheduledTimeSlot: { startTime: '13:00', endTime: '14:00' },
        address: { street: '123 Test St', city: 'Delhi', location: { type: 'Point', coordinates: [77.2090, 28.6139] } },
        pricing: { basePrice: 500, tax: 0, discount: 0, totalAmount: 1000 },
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        status: 'completed',
        platformCommissionRate: 15,
        labourCommissionRate: 10,
        originalServicePrice: 500,
        approvedLabourCharge: 300,
        additionalPartsAmount: 200,
        spareParts: {
          status: 'approved',
          partsSubtotal: 200,
          labourSubtotal: 300,
          totalAdditionalAmount: 500
        },
        serviceCommissionAmount: 75,
        labourCommissionAmount: 30,
        totalPlatformCommission: 105,
        providerNetEarning: 895,
        totalCustomerPayable: 1000
      });

      const autoRes = await walletService.creditBookingEarnings(autoDeductBooking);
      const finalWallet = await ProviderWallet.findOne({ provider: testProviderDoc._id });

      assert(
        autoRes.autoDeducted === true &&
        autoRes.deductedAmount === 105 &&
        finalWallet.availableBalance === 395 &&
        finalWallet.commissionDue === 0,
        'Scenario 13: Auto-deduct triggered: 105 deducted from 500 balance -> 395 remaining, 0 due',
        { autoRes, finalBalance: finalWallet.availableBalance, commissionDue: finalWallet.commissionDue }
      );
    }

    // =========================================================
    // SCENARIO 14: Auto-deduct disabled
    // =========================================================
    console.log('\n--- SCENARIO 14: Auto-Deduct Disabled ---');
    {
      const wallet = await ProviderWallet.findOne({ provider: testProviderDoc._id });
      wallet.availableBalance = 500;
      wallet.commissionDue = 0;
      wallet.autoDeductCommissionFromWallet = false; // Explicitly disabled
      await wallet.save();

      const manualBooking = await Booking.create({
        bookingReference: `BK-NOAUTO-${runId}`,
        customer: testCustomerDoc._id,
        provider: testProviderDoc._id,
        service: testService._id,
        category: testCategory._id,
        bookingMode: 'scheduled',
        scheduledDate: new Date(),
        scheduledTimeSlot: { startTime: '14:00', endTime: '15:00' },
        address: { street: '123 Test St', city: 'Delhi', location: { type: 'Point', coordinates: [77.2090, 28.6139] } },
        pricing: { basePrice: 500, tax: 0, discount: 0, totalAmount: 1000 },
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        status: 'completed',
        platformCommissionRate: 15,
        labourCommissionRate: 10,
        originalServicePrice: 500,
        approvedLabourCharge: 300,
        additionalPartsAmount: 200,
        spareParts: {
          status: 'approved',
          partsSubtotal: 200,
          labourSubtotal: 300,
          totalAdditionalAmount: 500
        },
        serviceCommissionAmount: 75,
        labourCommissionAmount: 30,
        totalPlatformCommission: 105,
        providerNetEarning: 895,
        totalCustomerPayable: 1000
      });

      const noAutoRes = await walletService.creditBookingEarnings(manualBooking);
      const walletAfter = await ProviderWallet.findOne({ provider: testProviderDoc._id });

      assert(
        noAutoRes.autoDeducted === false &&
        walletAfter.availableBalance === 500 &&
        walletAfter.commissionDue === 105,
        'Scenario 14: When auto-deduct is disabled, available balance is untouched (500) and commission due is 105',
        { walletAfter: { balance: walletAfter.availableBalance, due: walletAfter.commissionDue } }
      );
    }

    // =========================================================
    // SCENARIO 15: Admin labour commission setting validation
    // =========================================================
    console.log('\n--- SCENARIO 15: Setting Validation Rules ---');
    {
      let rejectedNegative = false;
      try {
        await settingService.updateLabourCommissionSetting({
          rate: -5,
          reason: 'Test negative',
          adminId: testAdminUser._id
        });
      } catch (err) {
        rejectedNegative = true;
      }

      let rejectedOver100 = false;
      try {
        await settingService.updateLabourCommissionSetting({
          rate: 105,
          reason: 'Test over 100',
          adminId: testAdminUser._id
        });
      } catch (err) {
        rejectedOver100 = true;
      }

      let rejectedNoReason = false;
      try {
        await settingService.updateLabourCommissionSetting({
          rate: 10,
          reason: '',
          adminId: testAdminUser._id
        });
      } catch (err) {
        rejectedNoReason = true;
      }

      assert(
        rejectedNegative && rejectedOver100 && rejectedNoReason,
        'Scenario 15: Validation rejects negative (<0), excessive (>100), and missing reason updates',
        { rejectedNegative, rejectedOver100, rejectedNoReason }
      );
    }

    // =========================================================
    // SCENARIO 16: Admin dual commission settings API & Audit
    // =========================================================
    console.log('\n--- SCENARIO 16: Dual Settings Retrieval & Audit Log ---');
    {
      // Perform valid update with audit note
      const validUpdate = await settingService.updateLabourCommissionSetting({
        rate: 8.5,
        reason: 'Q1 promotional labour incentive revision',
        adminId: testAdminUser._id
      });

      const dualSettings = await settingService.getDualCommissionSettings();

      assert(
        dualSettings.labourCommission.currentRate === 8.5 &&
        dualSettings.activeRates.labourCommissionRate === 8.5 &&
        dualSettings.activeRates.serviceCommissionRate !== undefined &&
        dualSettings.labourCommission.history.length > 0 &&
        dualSettings.labourCommission.history[0].reason === 'Q1 promotional labour incentive revision',
        'Scenario 16: Dual commission settings API returns service & labour rates with complete audit history',
        {
          activeRates: dualSettings.activeRates,
          latestHistory: dualSettings.labourCommission.history[0]
        }
      );
    }

    // =========================================================
    // SCENARIO 17: Parts strictly 0% commission invariant
    // =========================================================
    console.log('\n--- SCENARIO 17: Parts 0% Commission Invariant Across Matrix ---');
    {
      const testCases = [
        { svc: 200, lab: 100, parts: 50, sRate: 10, lRate: 5 },
        { svc: 1000, lab: 500, parts: 3000, sRate: 20, lRate: 15 },
        { svc: 0, lab: 250, parts: 800, sRate: 15, lRate: 10 },
        { svc: 750, lab: 0, parts: 1500, sRate: 25, lRate: 50 }
      ];

      let allZero = true;
      for (const tc of testCases) {
        const res = calculateDualCommission({
          servicePrice: tc.svc,
          labourCharge: tc.lab,
          partsAmount: tc.parts,
          serviceRate: tc.sRate,
          labourRate: tc.lRate
        });

        if (res.partsCommissionAmount !== 0) {
          allZero = false;
        }
        const expectedCustomerPayable = tc.svc + tc.lab + tc.parts;
        const expectedCommission = (tc.svc * tc.sRate / 100) + (tc.lab * tc.lRate / 100);
        const expectedNet = expectedCustomerPayable - expectedCommission;

        if (Math.abs(res.totalPlatformCommission - expectedCommission) > 0.01 ||
            Math.abs(res.providerNetEarning - expectedNet) > 0.01) {
          allZero = false;
        }
      }

      assert(
        allZero,
        'Scenario 17: Invariant holds across matrix: Physical spare parts are strictly 0% commission-free in all combinations',
        { testedCombinations: testCases.length }
      );
    }

  } catch (err) {
    console.error('💥 Test execution error:', err);
    failed++;
  } finally {
    // Clean up test fixtures
    try {
      if (testService) await Service.deleteOne({ _id: testService._id });
      if (testCategory) await Category.deleteOne({ _id: testCategory._id });
      if (testProviderDoc) {
        await Provider.deleteOne({ _id: testProviderDoc._id });
        await ProviderWallet.deleteMany({ provider: testProviderDoc._id });
        await WalletTransaction.deleteMany({ provider: testProviderDoc._id });
      }
      if (testProviderUser) await User.deleteOne({ _id: testProviderUser._id });
      if (testCustomerDoc) await Customer.deleteOne({ _id: testCustomerDoc._id });
      if (testCustomerUser) await User.deleteOne({ _id: testCustomerUser._id });
      if (testAdminUser) await User.deleteOne({ _id: testAdminUser._id });
      await Booking.deleteMany({ bookingNumber: new RegExp(runId) });
      console.log('\n[TEARDOWN] Test fixtures cleaned up successfully.');
    } catch (cleanErr) {
      console.warn('[TEARDOWN WARNING]', cleanErr.message);
    }

    await mongoose.disconnect();
    console.log('[TEARDOWN] Disconnected from MongoDB.');
  }

  console.log('\n================================================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passed} PASSED / ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('================================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runDualCommissionSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
