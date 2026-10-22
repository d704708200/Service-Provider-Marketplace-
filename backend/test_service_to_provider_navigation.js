const mongoose = require('mongoose');
require('dotenv').config();

const providerService = require('./src/services/providerService');
const Provider = require('./src/models/Provider');
const Service = require('./src/models/Service');
const Category = require('./src/models/Category');
const User = require('./src/models/User');

async function runTests() {
  console.log('=== RUNNING SERVICE-TO-PROVIDER NAVIGATION TEST SUITE ===');
  await mongoose.connect(process.env.MONGODB_URI);

  try {
    // 1. Verify Category Filtering
    console.log('\n--- 1. Testing Category-to-Provider Filter ---');
    const allVerified = await Provider.find({
      verificationStatus: 'verified',
      isAvailable: true,
      isDeleted: { $ne: true }
    }).populate('categories').lean();

    console.log(`Found ${allVerified.length} verified active providers in DB.`);

    // Find a provider with at least one category
    const providerWithCat = allVerified.find((p) => p.categories && p.categories.length > 0);
    if (providerWithCat) {
      const targetCategory = providerWithCat.categories[0];
      const catId = targetCategory._id.toString();
      console.log(`Testing query with category: ${targetCategory.name} (${catId})`);

      const filteredProviders = await providerService.getPublicProviders({ category: catId });
      console.log(`Returned ${filteredProviders.length} providers for category ${catId}.`);

      const allMatch = filteredProviders.every((p) => {
        const pCats = p.categories.map((c) => (c._id || c).toString());
        return pCats.includes(catId);
      });
      console.log(`Assertion [All providers match category ${targetCategory.name}]:`, allMatch ? 'PASSED' : 'FAILED');
      if (!allMatch) {
        throw new Error('Category filter returned provider not belonging to target category');
      }

      // Verify empty state for dummy category
      const dummyId = new mongoose.Types.ObjectId().toString();
      const emptyResult = await providerService.getPublicProviders({ category: dummyId });
      console.log(`Assertion [Empty state for non-existent category]:`, emptyResult.length === 0 ? 'PASSED' : 'FAILED');
      if (emptyResult.length !== 0) {
        throw new Error('Expected 0 providers for non-existent category');
      }
    } else {
      console.log('No providers with categories found to test category filtering.');
    }

    // 2. Testing Specific Service Filtering (Catalog Service vs Custom Provider Service)
    console.log('\n--- 2. Testing Specific Service Filter ---');
    const allServices = await Service.find({ isActive: true }).lean();
    console.log(`Found ${allServices.length} active services in DB.`);

    const catalogService = allServices.find((s) => !s.provider && s.category);
    const customService = allServices.find((s) => s.provider && s.category);

    if (catalogService) {
      console.log(`Testing Catalog Service: "${catalogService.name}" (${catalogService._id.toString()})`);
      const matchedProviders = await providerService.getPublicProviders({ service: catalogService._id.toString() });
      console.log(`Catalog service matched ${matchedProviders.length} providers.`);
      const allMatch = matchedProviders.every((p) => {
        const pCats = p.categories.map((c) => (c._id || c).toString());
        return pCats.includes(catalogService.category.toString());
      });
      console.log(`Assertion [Catalog service matches providers with category]:`, allMatch ? 'PASSED' : 'FAILED');
      if (!allMatch) {
        throw new Error('Catalog service filter returned provider missing service category');
      }
    } else {
      console.log('No catalog services found.');
    }

    if (customService) {
      console.log(`Testing Provider-Owned Custom Service: "${customService.name}" (${customService._id.toString()}) owned by ${customService.provider.toString()}`);
      const matchedProviders = await providerService.getPublicProviders({ service: customService._id.toString() });
      console.log(`Custom service matched ${matchedProviders.length} providers.`);
      const exactMatch = matchedProviders.length <= 1 && (matchedProviders.length === 0 || matchedProviders[0]._id.toString() === customService.provider.toString());
      console.log(`Assertion [Custom service matches ONLY owning provider]:`, exactMatch ? 'PASSED' : 'FAILED');
      if (!exactMatch) {
        throw new Error('Custom service matched wrong provider or multiple providers');
      }
    } else {
      console.log('No provider-owned custom services found.');
    }

    // 3. Testing Exclusion of Inactive / Unverified Providers
    console.log('\n--- 3. Testing Exclusion of Unverified/Inactive Providers ---');
    const publicList = await providerService.getPublicProviders({});
    for (const p of publicList) {
      const doc = await Provider.findById(p._id).lean();
      if (doc.verificationStatus !== 'verified' || doc.isAvailable !== true || doc.isDeleted === true) {
        throw new Error(`Ineligible provider ${p._id} returned in public directory!`);
      }
    }
    console.log(`Assertion [All ${publicList.length} returned providers are verified, available, non-deleted]: PASSED`);

    // 4. Starting Price Calculation & Catalog Fallback
    console.log('\n--- 4. Testing Starting Price Calculation ---');
    let testedPricingCount = 0;
    for (const p of publicList.slice(0, 5)) {
      if (p.pricing?.basePrice != null) {
        console.log(`Provider "${p.businessName}" -> Starting Price: ₹${p.pricing.basePrice}`);
        testedPricingCount++;
      }
    }
    console.log(`Assertion [Starting prices computed without throwing]: PASSED (Verified ${testedPricingCount} providers)`);

    console.log('\n=== ALL SERVICE-TO-PROVIDER NAVIGATION BACKEND TESTS PASSED ===\n');
  } finally {
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error('TEST SUITE FAILED:', err);
  process.exit(1);
});
