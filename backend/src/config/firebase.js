const admin = require('firebase-admin');
const { initializeApp, cert, applicationDefault, getApps } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');

let firebaseApp = null;
let messagingInstance = null;
let isConfigured = false;
let configuredProjectId = null;

const createCert = (serviceAccountObj) => {
  if (typeof cert === 'function') {
    return cert(serviceAccountObj);
  }
  if (admin && admin.credential && typeof admin.credential.cert === 'function') {
    return admin.credential.cert(serviceAccountObj);
  }
  if (admin && typeof admin.cert === 'function') {
    return admin.cert(serviceAccountObj);
  }
  throw new Error('No valid cert method found on firebase-admin');
};

const createApplicationDefault = () => {
  if (typeof applicationDefault === 'function') {
    return applicationDefault();
  }
  if (admin && admin.credential && typeof admin.credential.applicationDefault === 'function') {
    return admin.credential.applicationDefault();
  }
  if (admin && typeof admin.applicationDefault === 'function') {
    return admin.applicationDefault();
  }
  throw new Error('No valid applicationDefault method found on firebase-admin');
};

/**
 * Safely parse service account from environment
 * Supports:
 * 1. FIREBASE_SERVICE_ACCOUNT (raw JSON string or base64 encoded JSON string)
 * 2. FIREBASE_SERVICE_ACCOUNT_PATH (path to json file)
 * 3. GOOGLE_APPLICATION_CREDENTIALS (path to json file via Application Default Credentials)
 */
const initializeFirebase = () => {
  if (firebaseApp && messagingInstance) {
    return { admin, messaging: messagingInstance, isConfigured: true, projectId: configuredProjectId };
  }

  // Check already initialized apps
  const existingApps = getApps ? getApps() : (admin && admin.apps ? admin.apps : []);
  if (existingApps.length > 0) {
    firebaseApp = existingApps[0];
    messagingInstance = typeof getMessaging === 'function' ? getMessaging(firebaseApp) : admin.messaging();
    isConfigured = true;
    configuredProjectId =
      (firebaseApp.options && (firebaseApp.options.projectId || (firebaseApp.options.credential && firebaseApp.options.credential.projectId))) ||
      configuredProjectId ||
      null;
    return { admin, messaging: messagingInstance, isConfigured: true, projectId: configuredProjectId };
  }

  try {
    let credential = null;
    let projectId = null;

    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();

      // Safe check for explicit placeholder strings or empty values
      if (!raw || raw.startsWith('REPLACE_WITH_') || raw.startsWith('<') || raw.includes('your-project-id')) {
        isConfigured = false;
        if (process.env.NODE_ENV !== 'test') {
          console.warn('[Firebase] Placeholder credentials detected in FIREBASE_SERVICE_ACCOUNT. Push notifications are in standby mode.');
        }
        return { admin: null, messaging: null, isConfigured: false, projectId: null };
      }

      let serviceAccountObj;
      if (raw.startsWith('{')) {
        serviceAccountObj = JSON.parse(raw);
      } else {
        // Attempt base64 decode
        const decoded = Buffer.from(raw, 'base64').toString('utf8');
        serviceAccountObj = JSON.parse(decoded);
      }

      projectId = serviceAccountObj.project_id || null;
      credential = createCert(serviceAccountObj);
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const fs = require('fs');
      const path = require('path');
      const resolvedPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
      if (fs.existsSync(resolvedPath)) {
        const fileContent = fs.readFileSync(resolvedPath, 'utf8');
        const serviceAccountObj = JSON.parse(fileContent);
        projectId = serviceAccountObj.project_id || null;
        credential = createCert(serviceAccountObj);
      } else {
        console.warn(`[Firebase] Service account file not found at: ${resolvedPath}`);
      }
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      credential = createApplicationDefault();
    }

    if (credential) {
      if (typeof initializeApp === 'function') {
        firebaseApp = initializeApp({ credential });
      } else {
        firebaseApp = admin.initializeApp({ credential });
      }

      messagingInstance = typeof getMessaging === 'function' ? getMessaging(firebaseApp) : admin.messaging();
      isConfigured = true;
      configuredProjectId =
        projectId ||
        (firebaseApp.options && (firebaseApp.options.projectId || (firebaseApp.options.credential && firebaseApp.options.credential.projectId))) ||
        null;
      console.log(`[Firebase] Firebase Admin SDK successfully initialized for project: ${configuredProjectId}`);
      return { admin, messaging: messagingInstance, isConfigured: true, projectId: configuredProjectId };
    }

    // Safe unconfigured state (credentials pending)
    isConfigured = false;
    if (process.env.NODE_ENV !== 'test') {
      console.warn(
        '[Firebase] Service account credentials not provided. Push notifications are in standby mode.'
      );
    }
    return { admin: null, messaging: null, isConfigured: false, projectId: null };
  } catch (error) {
    isConfigured = false;
    console.error('[Firebase] Failed to initialize Firebase Admin SDK:', error.message);
    return { admin: null, messaging: null, isConfigured: false, projectId: null };
  }
};

let mockMessagingInstance = null;

const getFirebaseAdmin = () => {
  if (mockMessagingInstance) {
    return { messaging: () => mockMessagingInstance };
  }
  if (!firebaseApp && !isConfigured) {
    initializeFirebase();
  }
  return firebaseApp ? admin : null;
};

const getFirebaseMessaging = () => {
  if (mockMessagingInstance) {
    return mockMessagingInstance;
  }
  if (!firebaseApp && !isConfigured) {
    initializeFirebase();
  }
  return messagingInstance;
};

const isFirebaseConfigured = () => {
  if (mockMessagingInstance) {
    return true;
  }
  if (!firebaseApp && !isConfigured) {
    initializeFirebase();
  }
  return isConfigured;
};

const getFirebaseProjectId = () => {
  if (!firebaseApp && !isConfigured) {
    initializeFirebase();
  }
  return configuredProjectId;
};

// Allow test suites to inject mock messaging or reset state
const setMockMessaging = (mockMessaging) => {
  mockMessagingInstance = mockMessaging;
  isConfigured = Boolean(mockMessaging);
  return {
    admin: mockMessaging ? { messaging: () => mockMessaging } : null,
    messaging: mockMessaging,
    isConfigured: Boolean(mockMessaging)
  };
};

module.exports = {
  initializeFirebase,
  getFirebaseAdmin,
  getFirebaseMessaging,
  isFirebaseConfigured,
  getFirebaseProjectId,
  setMockMessaging
};
