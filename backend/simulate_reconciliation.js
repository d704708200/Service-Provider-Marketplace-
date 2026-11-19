const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env' });

async function simulateReconciliation() {
  await mongoose.connect(process.env.MONGODB_URI);

  console.log('--- RECONCILIATION SIMULATION ---');

  // Let's inspect all completed bookings that have accounting or pricing
  const completedBookings = await mongoose.connection.db.collection('bookings').find({
    status: 'completed'
  }).sort({ createdAt: 1 }).toArray();

  console.log(`Total completed bookings: ${completedBookings.length}`);

  // Fetch all wallet transactions
  const walletTxns = await mongoose.connection.db.collection('wallettransactions').find({}).sort({ createdAt: 1 }).toArray();
  const bookingEarnings = walletTxns.filter(t => t.type === 'booking_earning');
  const cashDueTxns = walletTxns.filter(t => t.type === 'CASH_BOOKING_COMMISSION_DUE');
  const recoveries = walletTxns.filter(t => ['COMMISSION_WALLET_AUTO_DEBIT', 'COMMISSION_PAYMENT', 'COMMISSION_WAIVER'].includes(t.type));

  console.log(`Booking earnings (online): ${bookingEarnings.length}`);
  console.log(`Cash commission due txns: ${cashDueTxns.length}`);
  console.log(`Recoveries / waivers: ${recoveries.length}`);

  await mongoose.disconnect();
}

simulateReconciliation().catch(console.error);

