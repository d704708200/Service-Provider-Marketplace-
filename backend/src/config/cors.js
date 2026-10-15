const cors = require('cors');

const getAllowedOrigins = () => {
  const origins = [];

  const addOrigins = (val) => {
    if (!val) return;
    val.split(',').forEach((o) => {
      const trimmed = o.trim();
      if (trimmed && !origins.includes(trimmed)) {
        origins.push(trimmed);
      }
    });
  };

  addOrigins(process.env.CUSTOMER_APP_URL);
  addOrigins(process.env.PROVIDER_APP_URL);
  addOrigins(process.env.ADMIN_PANEL_URL);

  // Always ensure the production Admin Panel URL is allowed
  const productionAdminPanel = 'https://serviceprovider3.netlify.app';
  if (!origins.includes(productionAdminPanel)) {
    origins.push(productionAdminPanel);
  }

  // Always allow standard local development origins
  const devOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:8081',
    'http://localhost:8082',
    'http://localhost:8083',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000'
  ];

  devOrigins.forEach((devOrigin) => {
    if (!origins.includes(devOrigin)) {
      origins.push(devOrigin);
    }
  });

  return origins;
};

const corsOptions = {
  origin: (origin, callback) => {
    const allowed = getAllowedOrigins();

    // Allow requests with no origin (e.g. mobile native apps, curl, Postman)
    if (!origin || allowed.includes('*') || allowed.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked for origin: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  maxAge: 86400 // 24 hours preflight cache
};

module.exports = cors(corsOptions);
