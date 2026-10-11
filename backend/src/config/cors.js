const cors = require('cors');

const getAllowedOrigins = () => {
  const origins = [];

  if (process.env.CUSTOMER_APP_URL) origins.push(process.env.CUSTOMER_APP_URL);
  if (process.env.PROVIDER_APP_URL) origins.push(process.env.PROVIDER_APP_URL);
  if (process.env.ADMIN_PANEL_URL) origins.push(process.env.ADMIN_PANEL_URL);

  // In development, allow common localhost ports if none configured
  if (origins.length === 0 && process.env.NODE_ENV !== 'production') {
    return ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8081', 'http://127.0.0.1:5173'];
  }

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
