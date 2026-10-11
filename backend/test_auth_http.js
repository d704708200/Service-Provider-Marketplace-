const http = require('http');
const dotenv = require('dotenv');
dotenv.config();

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

async function runHttpAuthTests() {
  const testPort = 5066;
  const server = app.listen(testPort);

  try {
    console.log('--- RUNNING AUTH HTTP ENDPOINT VALIDATION TESTS ---');

    // 1. GET /api/auth/me without token -> 401
    const resMeNoToken = await makeRequest(testPort, 'GET', '/api/auth/me');
    console.log('1. /api/auth/me without token:', resMeNoToken.status);
    if (resMeNoToken.status !== 401) throw new Error('Expected 401 for missing token');

    // 2. GET /api/auth/me with invalid token -> 401
    const resMeBadToken = await makeRequest(testPort, 'GET', '/api/auth/me', {
      Authorization: 'Bearer invalid.token.value'
    });
    console.log('2. /api/auth/me with invalid token:', resMeBadToken.status);
    if (resMeBadToken.status !== 401) throw new Error('Expected 401 for bad token');

    // 3. POST /api/auth/register/customer missing required fields -> 400
    const resRegCustBad = await makeRequest(testPort, 'POST', '/api/auth/register/customer', {}, {
      name: 'J', // too short
      email: 'not-an-email',
      phone: '123',
      password: '123' // too short
    });
    console.log('3. /api/auth/register/customer validation failure:', resRegCustBad.status);
    if (resRegCustBad.status !== 400) throw new Error('Expected 400 for invalid customer input');

    // 4. POST /api/auth/register/provider missing required fields -> 400
    const resRegProvBad = await makeRequest(testPort, 'POST', '/api/auth/register/provider', {}, {
      name: '',
      email: 'prov@example.com'
    });
    console.log('4. /api/auth/register/provider validation failure:', resRegProvBad.status);
    if (resRegProvBad.status !== 400) throw new Error('Expected 400 for invalid provider input');

    // 5. POST /api/auth/login/customer missing password -> 400
    const resLoginCustBad = await makeRequest(testPort, 'POST', '/api/auth/login/customer', {}, {
      email: 'alice@example.com'
    });
    console.log('5. /api/auth/login/customer missing password:', resLoginCustBad.status);
    if (resLoginCustBad.status !== 400) throw new Error('Expected 400 for missing password');

    // 6. POST /api/auth/login/admin missing email -> 400
    const resLoginAdminBad = await makeRequest(testPort, 'POST', '/api/auth/login/admin', {}, {
      password: 'password123'
    });
    console.log('6. /api/auth/login/admin missing email:', resLoginAdminBad.status);
    if (resLoginAdminBad.status !== 400) throw new Error('Expected 400 for missing admin email');

    console.log('--- ALL AUTH HTTP VALIDATION TESTS PASSED! ---');
  } finally {
    server.close();
  }
}

runHttpAuthTests().catch(err => {
  console.error('HTTP test failure:', err);
  process.exit(1);
});
