const http = require('http');
const app = require('./src/app');

function makeRequest(port, method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };
    if (payload) {
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      {
        hostname: 'localhost',
        port,
        path,
        method,
        headers: reqHeaders
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch (e) {
            parsed = data;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function runServiceUnitTests() {
  const testPort = 5092;
  const server = app.listen(testPort);

  console.log('--- RUNNING PHASE 7 SERVICES CATALOG HTTP & VALIDATION UNIT TESTS ---');

  try {
    // 1. Admin endpoints without token return 401
    const resAdminNoToken = await makeRequest(testPort, 'GET', '/api/services/admin');
    console.log('1. GET /api/services/admin without token:', resAdminNoToken.status);
    if (resAdminNoToken.status !== 401) throw new Error('Expected 401 for unauthenticated admin services list');
    console.log('✓ Admin listing rejects unauthenticated requests (401)');

    const resPostNoToken = await makeRequest(testPort, 'POST', '/api/services', {}, { name: 'Test' });
    console.log('2. POST /api/services without token:', resPostNoToken.status);
    if (resPostNoToken.status !== 401) throw new Error('Expected 401 for unauthenticated service creation');
    console.log('✓ Service creation rejects unauthenticated requests (401)');

    const resPutNoToken = await makeRequest(testPort, 'PUT', '/api/services/507f1f77bcf86cd799439011', {}, {});
    console.log('3. PUT /api/services/:id without token:', resPutNoToken.status);
    if (resPutNoToken.status !== 401) throw new Error('Expected 401 for unauthenticated service update');
    console.log('✓ Service update rejects unauthenticated requests (401)');

    const resPatchNoToken = await makeRequest(testPort, 'PATCH', '/api/services/507f1f77bcf86cd799439011/status', {}, { isActive: false });
    console.log('4. PATCH /api/services/:id/status without token:', resPatchNoToken.status);
    if (resPatchNoToken.status !== 401) throw new Error('Expected 401 for unauthenticated status change');
    console.log('✓ Service status toggle rejects unauthenticated requests (401)');

    const resDeleteNoToken = await makeRequest(testPort, 'DELETE', '/api/services/507f1f77bcf86cd799439011');
    console.log('5. DELETE /api/services/:id without token:', resDeleteNoToken.status);
    if (resDeleteNoToken.status !== 401) throw new Error('Expected 401 for unauthenticated service deletion');
    console.log('✓ Service deletion rejects unauthenticated requests (401)');

    // 2. Invalid ObjectId validations on endpoints
    const resInvalidId = await makeRequest(testPort, 'GET', '/api/services/invalid-mongodb-id');
    console.log('6. GET /api/services/invalid-id:', resInvalidId.status);
    if (resInvalidId.status !== 400) throw new Error('Expected 400 for invalid ObjectId param');
    console.log('✓ Invalid ID rejected with 400 Bad Request');

    // 3. Fake admin token to test validation middleware
    // We can forge a valid structure or test validation directly via token with dummy payload
    const { generateToken } = require('./src/utils/jwt');
    const dummyToken = generateToken({ userId: '507f1f77bcf86cd799439011', role: 'admin' });

    // Note: authenticate checks User in DB, so without DB or matching user it returns 401.
    // Let's test the validation middleware directly as functions to verify validation logic!
    const {
      validateCreateService,
      validateUpdateService,
      validateUpdateServiceStatus
    } = require('./src/middleware/validation');

    const runMiddleware = (middleware, reqBody, params = {}) => {
      return new Promise((resolve) => {
        const req = { body: reqBody, params };
        const res = {
          statusCode: 200,
          status(code) {
            this.statusCode = code;
            return this;
          },
          json(payload) {
            resolve({ status: this.statusCode, body: payload });
          }
        };
        const next = () => resolve({ status: 200, nextCalled: true });
        middleware(req, res, next);
      });
    };

    // 4. Validation: Missing name
    const v1 = await runMiddleware(validateCreateService, {
      category: '507f1f77bcf86cd799439011',
      price: 50
    });
    console.log('7. validateCreateService missing name:', v1.status);
    if (v1.status !== 400) throw new Error('Expected 400 for missing name');
    console.log('✓ Missing service name validated (400)');

    // 5. Validation: Missing/invalid category
    const v2 = await runMiddleware(validateCreateService, {
      name: 'Pipe Repair',
      category: 'bad-cat-id',
      price: 50
    });
    console.log('8. validateCreateService invalid category:', v2.status);
    if (v2.status !== 400) throw new Error('Expected 400 for invalid category ID');
    console.log('✓ Invalid category ObjectId validated (400)');

    // 6. Validation: Invalid priceType
    const v3 = await runMiddleware(validateCreateService, {
      name: 'Pipe Repair',
      category: '507f1f77bcf86cd799439011',
      price: 50,
      priceType: 'invalid-type'
    });
    console.log('9. validateCreateService invalid priceType:', v3.status);
    if (v3.status !== 400) throw new Error('Expected 400 for invalid priceType');
    console.log('✓ Invalid priceType rejected (400)');

    // 7. Validation: Fixed price with zero or negative price
    const v4 = await runMiddleware(validateCreateService, {
      name: 'Pipe Repair',
      category: '507f1f77bcf86cd799439011',
      price: 0,
      priceType: 'fixed'
    });
    console.log('10. validateCreateService price=0 on fixed type:', v4.status);
    if (v4.status !== 400) throw new Error('Expected 400 for zero fixed price');
    console.log('✓ Zero price rejected on fixed pricing model (400)');

    // 8. Validation: Quote price with zero price is allowed
    const v5 = await runMiddleware(validateCreateService, {
      name: 'Custom Inspection',
      category: '507f1f77bcf86cd799439011',
      price: 0,
      priceType: 'quote'
    });
    console.log('11. validateCreateService price=0 on quote type:', v5.nextCalled);
    if (!v5.nextCalled) throw new Error('Expected quote price=0 to be valid');
    console.log('✓ Zero price accepted on quote pricing model (Valid)');

    // 9. Validation: Invalid duration (< 1 or non-integer)
    const v6 = await runMiddleware(validateCreateService, {
      name: 'Pipe Repair',
      category: '507f1f77bcf86cd799439011',
      price: 50,
      estimatedDurationMinutes: -10
    });
    console.log('12. validateCreateService duration=-10:', v6.status);
    if (v6.status !== 400) throw new Error('Expected 400 for negative duration');
    console.log('✓ Negative duration rejected (400)');

    // 10. Validation: Status update requires boolean isActive
    const v7 = await runMiddleware(validateUpdateServiceStatus, { isActive: 'true' });
    console.log('13. validateUpdateServiceStatus non-boolean:', v7.status);
    if (v7.status !== 400) throw new Error('Expected 400 for string isActive');
    console.log('✓ Non-boolean status rejected (400)');

    const v8 = await runMiddleware(validateUpdateServiceStatus, { isActive: true });
    console.log('14. validateUpdateServiceStatus boolean:', v8.nextCalled);
    if (!v8.nextCalled) throw new Error('Expected boolean isActive to be valid');
    console.log('✓ Valid status boolean accepted');

    console.log('--- ALL PHASE 7 SERVICE UNIT & VALIDATION TESTS PASSED! ---');
  } finally {
    server.close();
  }
}

runServiceUnitTests().catch((err) => {
  console.error('Service unit test error:', err);
  process.exit(1);
});
