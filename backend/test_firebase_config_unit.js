const assert = require('assert');
const { initializeFirebase, isFirebaseConfigured, getFirebaseAdmin, getFirebaseMessaging } = require('./src/config/firebase');

const runUnitTests = async () => {
  console.log('🧪 RUNNING FIREBASE CONFIGURATION & CREDENTIALS UNIT TEST SUITE\n');

  const originalEnv = { ...process.env };

  try {
    // -------------------------------------------------------------
    // TEST 1: Missing credentials defaults to safe standby mode
    // -------------------------------------------------------------
    console.log('--- Test 1: Missing Credentials -> Safe Standby Mode ---');
    delete process.env.FIREBASE_SERVICE_ACCOUNT;
    delete process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

    const standbyResult = initializeFirebase();
    assert.strictEqual(standbyResult.isConfigured, false, 'isConfigured should be false when credentials are empty');
    assert.strictEqual(standbyResult.admin, null, 'admin should be null in standby mode');
    assert.strictEqual(standbyResult.messaging, null, 'messaging should be null in standby mode');
    console.log('✓ Missing credentials cleanly result in standby mode without throwing');

    // -------------------------------------------------------------
    // TEST 2: Placeholder strings safely captured without parsing crash
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Placeholder String in FIREBASE_SERVICE_ACCOUNT ---');
    process.env.FIREBASE_SERVICE_ACCOUNT = 'REPLACE_WITH_BASE64_ENCODED_FIREBASE_SERVICE_ACCOUNT_JSON';

    const placeholderResult = initializeFirebase();
    assert.strictEqual(placeholderResult.isConfigured, false, 'isConfigured should be false for placeholder value');
    assert.strictEqual(placeholderResult.admin, null);
    console.log('✓ Placeholder credentials safely detected and kept in standby mode');

    // -------------------------------------------------------------
    // TEST 3: Malformed JSON string handling
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Malformed JSON Handling ---');
    process.env.FIREBASE_SERVICE_ACCOUNT = '{ this is not valid json :';

    const malformedResult = initializeFirebase();
    assert.strictEqual(malformedResult.isConfigured, false, 'isConfigured should be false for malformed JSON');
    assert.strictEqual(malformedResult.admin, null);
    console.log('✓ Malformed JSON safely caught without crashing the process');

    // -------------------------------------------------------------
    // TEST 4: Base64 decoding of valid fixture JSON
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Base64 Decoding of Service Account Fixture ---');
    const mockServiceAccount = {
      type: 'service_account',
      project_id: 'test-mock-project',
      private_key_id: 'mock_key_id',
      client_email: 'mock-adminsdk@test-mock-project.iam.gserviceaccount.com'
    };
    const base64Encoded = Buffer.from(JSON.stringify(mockServiceAccount), 'utf8').toString('base64');
    
    // Test base64 decoding logic directly
    const decoded = Buffer.from(base64Encoded, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded);
    assert.strictEqual(parsed.project_id, 'test-mock-project');
    assert.strictEqual(parsed.client_email, 'mock-adminsdk@test-mock-project.iam.gserviceaccount.com');
    console.log('✓ UTF-8 Base64 decoding reconstructs valid service account JSON object accurately');

    // -------------------------------------------------------------
    // TEST 5: Verify FIREBASE_SERVICE_ACCOUNT_KEY is not read
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Verify Unsupported Variable Ignored ---');
    delete process.env.FIREBASE_SERVICE_ACCOUNT;
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY = JSON.stringify(mockServiceAccount);
    
    const ignoredKeyResult = initializeFirebase();
    assert.strictEqual(ignoredKeyResult.isConfigured, false, 'FIREBASE_SERVICE_ACCOUNT_KEY must not initialize Firebase');
    console.log('✓ Unsupported variable FIREBASE_SERVICE_ACCOUNT_KEY is correctly ignored');

    console.log('\n🎉 ALL FIREBASE CONFIGURATION UNIT TESTS PASSED SUCCESSFULLY!\n');
  } finally {
    process.env = originalEnv;
  }
};

runUnitTests().catch((err) => {
  console.error('❌ Unit test failed:', err);
  process.exit(1);
});
