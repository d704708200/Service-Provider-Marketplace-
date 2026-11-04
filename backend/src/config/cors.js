const cors = require('cors');

const normalizeOrigin = (val) => {
  if (!val || typeof val !== 'string') return '';
  return val.trim().replace(/\/+$/, '');
};

const devOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:8082',
  'http://localhost:8083',
  'http://localhost:8084',
  'http://localhost:8085',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:8082',
  'http://127.0.0.1:8083',
  'http://127.0.0.1:8084',
  'http://127.0.0.1:8085'
];

const productionOrigins = [
  'https://serviceprovider3.netlify.app',
  'https://service-provider-marketplace.onrender.com'
];

const getAllowedOrigins = () => {
  const origins = new Set();

  const addOrigins = (val) => {
    if (!val) return;
    val.split(',').forEach((o) => {
      const normalized = normalizeOrigin(o);
      if (normalized) {
        origins.add(normalized);
      }
    });
  };

  // Environment-configured origins
  addOrigins(process.env.CORS_ORIGINS);
  addOrigins(process.env.ALLOWED_ORIGINS);
  addOrigins(process.env.CUSTOMER_APP_URL);
  addOrigins(process.env.PROVIDER_APP_URL);
  addOrigins(process.env.ADMIN_PANEL_URL);
  addOrigins(process.env.FRONTEND_URL);

  // Production deployed web apps
  productionOrigins.forEach((o) => origins.add(normalizeOrigin(o)));

  // Development local origins (always allowed for local web & testing)
  devOrigins.forEach((o) => origins.add(normalizeOrigin(o)));

  return Array.from(origins);
};

const isOriginAllowed = (origin) => {
  // Allow requests with no origin (e.g. mobile native apps, curl, Postman, internal calls)
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  const allowed = getAllowedOrigins();
  if (allowed.includes('*') || allowed.includes(normalized)) {
    return true;
  }
  return false;
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked for origin: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'Origin',
    'X-Requested-With',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400, // 24 hours preflight cache
  optionsSuccessStatus: 204
};

const corsMiddleware = cors(corsOptions);

module.exports = corsMiddleware;
module.exports.corsMiddleware = corsMiddleware;
module.exports.isOriginAllowed = isOriginAllowed;
module.exports.getAllowedOrigins = getAllowedOrigins;
