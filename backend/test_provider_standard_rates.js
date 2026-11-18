const dotenv = require('dotenv');
dotenv.config();

const assert = require('assert');
const http = require('http');
const mongoose = require('mongoose');
const { User, Category, ServiceTag, Provider, Service } = require('./src/models');
const providerService = require('./src/services/providerService');
const tagService = require('./src/services/tagService');
const bookingService = require('./src/services/bookingService');
const app = require('./src/app');

const uniqueId = Date.now().toString();
let category;
let serviceTags = [];
let users = [];
let providers = [];
let services = [];
let platformService;
let server;
let baseUrl;

const request = (path) =>
  new Promise((resolve, reject) => {
    http.get(`${baseUrl}${path}`, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        try {
          resolve({ status: response.statusCode, body: JSON.parse(body) });
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });

async function setup() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required to run provider standard rate tests');
  }
  await mongoose.connect(process.env.MONGODB_URI);

  category = await Category.create({
    name: `Rate Test Category ${uniqueId}`,
    slug: `rate-test-category-${uniqueId}`,
    isActive: true
  });
  serviceTags = await ServiceTag.create([
    {
      name: `Rate Test Fixed Service ${uniqueId}`,
      slug: `rate-test-fixed-${uniqueId}`,
      category: category._id,
      isActive: true,
      isCustomerVisible: true
    },
    {
      name: `Rate Test Hourly Service ${uniqueId}`,
      slug: `rate-test-hourly-${uniqueId}`,
      category: category._id,
      isActive: true,
      isCustomerVisible: true
    },
    {
      name: `Rate Test Inactive Service ${uniqueId}`,
      slug: `rate-test-inactive-${uniqueId}`,
      category: category._id,
      isActive: false,
      isCustomerVisible: true
    },
    {
      name: `Rate Test Pending Service ${uniqueId}`,
      slug: `rate-test-pending-${uniqueId}`,
      category: category._id,
      isActive: true,
      isCustomerVisible: true
    },
    {
      name: `Rate Test Zero Service ${uniqueId}`,
      slug: `rate-test-zero-${uniqueId}`,
      category: category._id,
      isActive: true,
      isCustomerVisible: true
    },
    {
      name: `Rate Test Quote Service ${uniqueId}`,
      slug: `rate-test-quote-${uniqueId}`,
      category: category._id,
      isActive: true,
      isCustomerVisible: true
    }
  ]);

  for (let index = 0; index < 4; index += 1) {
    const user = await User.create({
      name: `Rate Provider ${index + 1} ${uniqueId}`,
      email: `rate-provider-${index + 1}-${uniqueId}@example.com`,
      phone: `97${String(Date.now() + index).slice(-8)}`,
      password: 'Password123',
      role: 'provider'
    });
    users.push(user);
    providers.push(await Provider.create({
      user: user._id,
      businessName: `Rate Provider ${index + 1}`,
      categories: [category._id],
      verificationStatus: 'verified',
      isAvailable: true,
      serviceTags: index === 0
        ? [
            { tag: serviceTags[0]._id, isActive: true, approvalStatus: 'approved', basePrice: 499, pricingType: 'fixed' },
            { tag: serviceTags[1]._id, isActive: true, approvalStatus: 'approved', basePrice: 299, pricingType: 'hourly' },
            { tag: serviceTags[2]._id, isActive: true, approvalStatus: 'approved', basePrice: 1, pricingType: 'fixed' },
            { tag: serviceTags[3]._id, isActive: true, approvalStatus: 'pending', basePrice: 2, pricingType: 'fixed' },
            { tag: serviceTags[4]._id, isActive: true, approvalStatus: 'approved', basePrice: 0, pricingType: 'fixed' },
            { tag: serviceTags[5]._id, isActive: true, approvalStatus: 'approved', basePrice: 625, pricingType: 'quote' }
          ]
        : index === 1
        ? [{ tag: serviceTags[0]._id, isActive: true, approvalStatus: 'approved', basePrice: 799, pricingType: 'fixed' }]
        : []
    }));
  }

  services.push(await Service.create({
    provider: providers[0]._id,
    category: category._id,
    name: `Provider Rate Service A ${uniqueId}`,
    price: 350,
    priceType: 'fixed',
    isActive: true
  }));
  services.push(await Service.create({
    provider: providers[0]._id,
    category: category._id,
    name: `Provider Rate Service B ${uniqueId}`,
    price: 550,
    priceType: 'fixed',
    isActive: true
  }));
  services.push(await Service.create({
    provider: providers[1]._id,
    category: category._id,
    name: `Provider Rate Service C ${uniqueId}`,
    price: 900,
    priceType: 'fixed',
    isActive: true
  }));
  platformService = await Service.create({
    category: category._id,
    name: `Platform Rate Service ${uniqueId}`,
    price: 700,
    priceType: 'fixed',
    isActive: true
  });

  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}/api`;
      resolve();
    });
  });
}

async function teardown() {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (services.length) await Service.deleteMany({ _id: { $in: services.map((item) => item._id) } });
  if (platformService) await Service.deleteOne({ _id: platformService._id });
  if (providers.length) await Provider.deleteMany({ _id: { $in: providers.map((item) => item._id) } });
  if (serviceTags.length) await ServiceTag.deleteMany({ _id: { $in: serviceTags.map((item) => item._id) } });
  if (category) await Category.deleteOne({ _id: category._id });
  if (users.length) await User.deleteMany({ _id: { $in: users.map((item) => item._id) } });
  if (mongoose.connection.readyState) await mongoose.disconnect();
}

async function run() {
  try {
    await setup();

    const tagRates = await tagService.getProvidersByCategoryAndTag(category._id.toString(), {
      tagId: serviceTags[0]._id.toString()
    });
    const provider1TagRate = tagRates.providers.find(
      (item) => String(item._id) === String(providers[0]._id)
    );
    const provider2TagRate = tagRates.providers.find(
      (item) => String(item._id) === String(providers[1]._id)
    );
    assert.strictEqual(provider1TagRate.standardRate.min, 499);
    assert.strictEqual(provider1TagRate.standardRate.max, 499);
    assert.strictEqual(provider1TagRate.standardRate.sourceType, 'tag');
    assert.strictEqual(provider1TagRate.standardRate.pricingType, 'fixed');
    assert.strictEqual(provider2TagRate.standardRate.min, 799);
    assert.strictEqual(provider2TagRate.standardRate.max, 799);

    const selectedServiceRate = await tagService.getProvidersByCategoryAndTag(category._id.toString(), {
      tagId: serviceTags[0]._id.toString(),
      serviceId: services[0]._id.toString()
    });
    assert.strictEqual(selectedServiceRate.providers.length, 1);
    assert.strictEqual(selectedServiceRate.providers[0].standardRate.min, 499);
    assert.strictEqual(selectedServiceRate.providers[0].standardRate.max, 499);

    const customServiceRate = await tagService.getProvidersByCategoryAndTag(category._id.toString(), {
      serviceId: services[0]._id.toString()
    });
    assert.strictEqual(customServiceRate.providers.length, 1);
    assert.strictEqual(customServiceRate.providers[0].standardRate.amount, 350);
    assert.strictEqual(customServiceRate.providers[0].standardRate.sourceType, 'service');

    const categoryServiceRate = await tagService.getProvidersByCategoryAndTag(category._id.toString(), {
      serviceId: platformService._id.toString()
    });
    const providerWithCategoryServiceRate = categoryServiceRate.providers.find(
      (item) => String(item._id) === String(providers[0]._id)
    );
    assert.strictEqual(providerWithCategoryServiceRate.standardRate.amount, 299);
    assert.strictEqual(providerWithCategoryServiceRate.standardRate.sourceType, 'tag');
    assert.strictEqual(providerWithCategoryServiceRate.standardRate.isStartingFrom, true);

    const hourlyTagRate = await tagService.getProvidersByCategoryAndTag(category._id.toString(), {
      tagId: serviceTags[1]._id.toString()
    });
    assert.strictEqual(hourlyTagRate.providers[0].standardRate.amount, 299);
    assert.strictEqual(hourlyTagRate.providers[0].standardRate.pricingType, 'hourly');

    const inactiveTagRate = await tagService.getProvidersByCategoryAndTag(category._id.toString(), {
      tagId: serviceTags[2]._id.toString()
    });
    assert.strictEqual(inactiveTagRate.providers.length, 0);

    const pendingTagRate = await tagService.getProvidersByCategoryAndTag(category._id.toString(), {
      tagId: serviceTags[3]._id.toString()
    });
    assert.strictEqual(pendingTagRate.providers.length, 0);

    const zeroTagRate = await tagService.getProvidersByCategoryAndTag(category._id.toString(), {
      tagId: serviceTags[4]._id.toString()
    });
    assert.strictEqual(zeroTagRate.providers[0].standardRate, null);
    assert.strictEqual(zeroTagRate.providers[0].rateStatus, 'not_configured');

    const quoteTagRate = await tagService.getProvidersByCategoryAndTag(category._id.toString(), {
      tagId: serviceTags[5]._id.toString()
    });
    assert.strictEqual(quoteTagRate.providers[0].standardRate.amount, 625);
    assert.strictEqual(quoteTagRate.providers[0].standardRate.pricingType, 'quote');

    const categoryRates = await tagService.getProvidersByCategoryAndTag(category._id.toString());
    const provider1CategoryRate = categoryRates.providers.find(
      (item) => String(item._id) === String(providers[0]._id)
    );
    const provider3CategoryRate = categoryRates.providers.find(
      (item) => String(item._id) === String(providers[2]._id)
    );
    assert.strictEqual(provider1CategoryRate.standardRate.amount, 299);
    assert.strictEqual(provider1CategoryRate.standardRate.min, 299);
    assert.strictEqual(provider1CategoryRate.standardRate.max, 499);
    assert.strictEqual(provider1CategoryRate.standardRate.pricingType, 'hourly');
    assert.strictEqual(provider1CategoryRate.standardRate.isStartingFrom, true);
    assert.strictEqual(provider3CategoryRate.standardRate, null);
    assert.strictEqual(provider3CategoryRate.rateStatus, 'not_available');
    const noRateProvider = categoryRates.providers.find(
      (item) => String(item._id) === String(providers[2]._id)
    );
    assert.strictEqual(noRateProvider.rateStatus, 'not_available');

    const zeroOnlyProviderResult = await tagService.getProvidersByCategoryAndTag(category._id.toString(), {
      tagId: serviceTags[4]._id.toString()
    });
    assert.strictEqual(zeroOnlyProviderResult.providers[0].rateStatus, 'not_configured');

    const httpResponse = await request(
      `/providers/by-category/${category._id}?tagId=${serviceTags[0]._id}`
    );
    assert.strictEqual(httpResponse.status, 200);
    const httpProvider = httpResponse.body.data.providers.find(
      (item) => String(item._id) === String(providers[0]._id)
    );
    assert.strictEqual(httpProvider.standardRate.amount, 499);
    assert.strictEqual(httpProvider.standardRate.tagId, String(serviceTags[0]._id));
    assert.strictEqual(httpProvider.standardRate.pricingType, 'fixed');

    const allHttpResponse = await request(`/providers/by-category/${category._id}`);
    assert.strictEqual(allHttpResponse.status, 200);
    const allHttpProvider = allHttpResponse.body.data.providers.find(
      (item) => String(item._id) === String(providers[0]._id)
    );
    assert.strictEqual(allHttpProvider.standardRate.amount, 299);
    assert.strictEqual(allHttpProvider.standardRate.sourceType, 'tag');
    assert.strictEqual(allHttpProvider.standardRate.tagId, String(serviceTags[1]._id));
    assert.strictEqual(allHttpProvider.standardRate.pricingType, 'hourly');
    assert.strictEqual(allHttpProvider.standardRate.isStartingFrom, true);

    const trustedTagPricing = bookingService.getTrustedBookingPricing(
      { price: 350, priceType: 'fixed' },
      providers[0],
      { _id: serviceTags[1]._id }
    );
    assert.deepStrictEqual(trustedTagPricing, { amount: 299, pricingType: 'hourly' });
    assert.throws(
      () => bookingService.getTrustedBookingPricing(
        { price: 350, priceType: 'fixed' },
        providers[0],
        { _id: serviceTags[3]._id }
      ),
      /no valid configured rate/
    );

    const genericProviderRates = await providerService.getPublicProviders({
      category: category._id.toString()
    });
    const genericProvider1 = genericProviderRates.find(
      (item) => String(item._id) === String(providers[0]._id)
    );
    assert.strictEqual(genericProvider1.pricing.standardRate.min, 299);
    assert.strictEqual(genericProvider1.pricing.standardRate.max, 499);

    const exactGenericRate = await providerService.getPublicProviders({
      service: services[0]._id.toString()
    });
    assert.strictEqual(exactGenericRate.length, 1);
    assert.strictEqual(exactGenericRate[0].pricing.standardRate.min, 350);
    assert.strictEqual(exactGenericRate[0].pricing.standardRate.max, 350);

    console.log('Provider standard rate tests passed for API responses, selected tags, pricing types, and unavailable rates.');
  } finally {
    await teardown();
  }
}

run().catch((error) => {
  console.error('Provider standard rate tests failed:', error);
  process.exitCode = 1;
});
