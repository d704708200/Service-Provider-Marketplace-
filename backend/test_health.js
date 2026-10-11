const http = require('http');
const dotenv = require('dotenv');
dotenv.config();

const app = require('./src/app');

const testPort = 5055;
const server = app.listen(testPort, () => {
  http.get(`http://localhost:${testPort}/api/health`, (res) => {
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
      console.log('--- Health Endpoint HTTP Status ---:', res.statusCode);
      console.log('--- Health Endpoint Response ---:');
      console.log(JSON.stringify(JSON.parse(rawData), null, 2));

      // Test 404 handler
      http.get(`http://localhost:${testPort}/api/non-existent-route`, (res404) => {
        let raw404 = '';
        res404.on('data', (chunk) => { raw404 += chunk; });
        res404.on('end', () => {
          console.log('--- 404 Handler HTTP Status ---:', res404.statusCode);
          console.log('--- 404 Response ---:', JSON.parse(raw404));

          server.close(() => {
            console.log('Health check and middleware tests finished successfully.');
            process.exit(0);
          });
        });
      });
    });
  }).on('error', (e) => {
    console.error('Request failed:', e.message);
    server.close(() => process.exit(1));
  });
});
