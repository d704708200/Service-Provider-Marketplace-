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

const app = express();

// Security headers
app.use(helmet());

// Cross-Origin Resource Sharing
app.use(corsMiddleware);

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

// Health Check Endpoint (reporting system and DB status without exposing internal details)
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

// 404 Handler
app.use(notFoundHandler);

// Centralized Error Handler
app.use(errorHandler);

module.exports = app;
