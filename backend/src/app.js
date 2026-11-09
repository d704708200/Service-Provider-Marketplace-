const express = require('express');
const helmet = require('helmet');
const corsMiddleware = require('./config/cors');
const { getDBStatus } = require('./config/db');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

// Route Imports
const authRoutes = require('./routes/authRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const providerRoutes = require('./routes/providerRoutes');
const customerRoutes = require('./routes/customerRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const bannerRoutes = require('./routes/bannerRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const serviceAreaRoutes = require('./routes/serviceAreaRoutes');
const reportRoutes = require('./routes/reportRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const { publicRouter: homeBannerPublicRoutes, adminRouter: homeBannerAdminRoutes } = require('./routes/homeBannerRoutes');
const { providerRouter: providerWalletRoutes, adminRouter: adminWalletRoutes } = require('./routes/walletRoutes');
const tagRoutes = require('./routes/tagRoutes');
const providerMyServicesRoutes = require('./routes/providerMyServicesRoutes');
const serviceRadiusRoutes = require('./routes/serviceRadiusRoutes');
const settingRoutes = require('./routes/settingRoutes');
const { initializeFirebase, isFirebaseConfigured, getFirebaseProjectId } = require('./config/firebase');

// Initialize Firebase Admin SDK (safe startup)
initializeFirebase();

const app = express();

// Cross-Origin Resource Sharing (CORS) & Preflight Handling (mounted first)
app.use(corsMiddleware);
app.options('*', corsMiddleware);

// Security headers (configured to allow cross-origin assets)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files serving for uploaded assets (avatars, docs)
const path = require('path');
app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(path.join(__dirname, '../uploads'))
);

// Health Check Endpoint (reporting system, DB and Firebase status without exposing secrets)
app.get('/api/health', (req, res) => {
  const dbStatus = getDBStatus();

  res.status(200).json({
    success: true,
    message: 'Service Provider Marketplace API is running',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    database: {
      status: dbStatus.state,
      connected: dbStatus.isConnected
    },
    firebase: {
      configured: isFirebaseConfigured(),
      projectId: getFirebaseProjectId()
    },
    environment: process.env.NODE_ENV || 'development'
  });
});

// Root welcome route
app.get('/', (req, res) => {
  res.json({
    name: 'Service Provider Marketplace API',
    version: '1.0.0',
    documentation: '/docs',
    health: '/api/health'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/providers', providerRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/banner', bannerRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/locations', serviceAreaRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/home-banners', homeBannerPublicRoutes);
app.use('/api/admin/home-banners', homeBannerAdminRoutes);
app.use('/api/provider/wallet', providerWalletRoutes);
app.use('/api/admin/wallets', adminWalletRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/admin/tags', tagRoutes);
app.use('/api/provider/my-services', providerMyServicesRoutes);
app.use('/api/service-radii', serviceRadiusRoutes);
app.use('/api/admin/service-radii', serviceRadiusRoutes);
app.use('/api/admin/settings', settingRoutes);

// 404 Handler
app.use(notFoundHandler);

// Centralized Error Handler
app.use(errorHandler);

module.exports = app;
