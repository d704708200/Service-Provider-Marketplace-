const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { Category, ServiceTag, Provider, Service, Booking } = require('../models');

const DEFAULT_CATEGORY_TAGS = {
  'Bike Car Mechanic': [
    { name: 'Bike Repair', subcategory: 'Two Wheeler', description: 'Comprehensive bike, motorcycle and scooter repair & servicing' },
    { name: 'Car Repair', subcategory: 'Four Wheeler', description: 'Car engine diagnostics, brake service, oil change & mechanical repair' },
    { name: 'Tyre & Wheel Care', subcategory: 'General', description: 'Puncture repair, wheel alignment & tyre replacement' },
    { name: 'Emergency Breakdown', subcategory: 'Emergency', description: '24/7 on-road vehicle breakdown assistance & towing' },
    { name: 'Brake & Engine Service', subcategory: 'Mechanical', description: 'Engine overhaul, brake pad replacement & clutch service' }
  ],
  Electrician: [
    { name: 'Wiring & Switch Repair', subcategory: 'Repair', description: 'Faulty wiring diagnostics, switchboard repair & earthing' },
    { name: 'Fan & Light Installation', subcategory: 'Installation', description: 'Ceiling fan, chandelier, LED & smart lighting installation' },
    { name: 'Inverter & Battery Setup', subcategory: 'Power Backup', description: 'Home inverter installation, battery check & wiring' },
    { name: 'MCB & Fuse Troubleshooting', subcategory: 'Safety', description: 'Circuit breaker tripping repair and distribution board fixing' }
  ],
  Plumber: [
    { name: 'Leakage & Seepage Repair', subcategory: 'Repair', description: 'Pipe leakage, joint sealing & concealed pipe diagnostics' },
    { name: 'Tap & Shower Fitting', subcategory: 'Fitting', description: 'Bathroom faucets, shower heads, jet spray & tap installation' },
    { name: 'Drainage & Pipe Blockage', subcategory: 'Drainage', description: 'Kitchen sink unclogging, bathroom drain & sewer cleaning' },
    { name: 'Water Tank & Motor Repair', subcategory: 'Pumping', description: 'Overhead tank cleaning, water pump motor installation' }
  ],
  'AC Service': [
    { name: 'AC Servicing & Filter Wash', subcategory: 'Maintenance', description: 'Jet pump coil wash, filter cleaning & cooling check' },
    { name: 'Gas Refill & Leak Fix', subcategory: 'Repair', description: 'Refrigerant gas top-up and condenser coil leak soldering' },
    { name: 'AC Installation & Uninstallation', subcategory: 'Installation', description: 'Split or window AC mounting, copper piping & testing' }
  ],
  Carpenter: [
    { name: 'Furniture Assembly & Repair', subcategory: 'Furniture', description: 'Bed, wardrobe, dining table assembly & hinge repairs' },
    { name: 'Door & Lock Fitting', subcategory: 'Fixtures', description: 'Door alignment, mortise lock installation & latch fixes' },
    { name: 'Custom Shelving & Modular Woodwork', subcategory: 'Custom', description: 'Wall shelves, wooden brackets & kitchen cabinet repairs' }
  ],
  Painter: [
    { name: 'Full Home Interior Painting', subcategory: 'Interior', description: 'Wall putty, primer application & premium emulsion coats' },
    { name: 'Waterproofing & Damp Proofing', subcategory: 'Protection', description: 'Wall seepage treatment, crack filling & moisture barrier' },
    { name: 'Exterior Weather Protection', subcategory: 'Exterior', description: 'Weathercoat painting, fungus removal & exterior primer' }
  ],
  'RO / Water Purifier repair': [
    { name: 'RO Filter Replacement', subcategory: 'Filtration', description: 'Sediment, carbon and pre-filter candle replacement' },
    { name: 'RO Membrane Service', subcategory: 'Purification', description: 'Membrane cleaning, TDS adjustment and booster pump check' },
    { name: 'Water Purifier Installation', subcategory: 'Installation', description: 'New purifier mounting, plumbing connection and initial flush' }
  ],
  'Washing machine repair': [
    { name: 'Drum & Spin Repair', subcategory: 'Mechanical', description: 'Drum bearing, spider arm and spin cycle vibration fixes' },
    { name: 'Motor & Belt Fix', subcategory: 'Drive System', description: 'Drive motor testing, capacitor replacement and belt tightening' },
    { name: 'Water Inlet & Drainage Repair', subcategory: 'Plumbing', description: 'Inlet solenoid valve, drain pump unclogging and pipe sealing' }
  ],
  'Women’s Beauty Services': [
    { name: 'Hair Care & Styling', subcategory: 'Hair', description: 'Haircut, keratin treatment, hair spa and coloring' },
    { name: 'Facial & Skin Cleanup', subcategory: 'Skincare', description: 'Fruit facial, anti-tan cleanup and skin brightening' },
    { name: 'Waxing & Threading', subcategory: 'Grooming', description: 'Full body waxing, eyebrow shaping and upper lip threading' }
  ]
};

const runMigration = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('[MIGRATION_ERROR] MONGODB_URI not found in environment.');
    process.exit(1);
  }

  console.log('=== STARTING DYNAMIC SERVICE TAG MIGRATION ===');
  await mongoose.connect(uri);
  console.log('[OK] Connected to MongoDB Atlas');

  try {
    // Clean up any legacy provider docs with invalid location without coordinates
    await Provider.updateMany(
      { 'location.type': 'Point', 'location.coordinates': { $exists: false } },
      { $unset: { location: 1 } }
    );
    await Provider.updateMany(
      { 'location.type': 'Point', 'location.coordinates': null },
      { $unset: { location: 1 } }
    );

    // 1. Ensure indexes
    console.log('[1/4] Ensuring database indexes...');
    await ServiceTag.syncIndexes();
    await Provider.syncIndexes();
    await Booking.syncIndexes();
    console.log('[OK] Indexes synchronized successfully');

    // 2. Fetch existing categories
    const categories = await Category.find({}).lean();
    console.log(`[2/4] Found ${categories.length} existing categories`);

    let createdTagsCount = 0;
    let existingTagsCount = 0;

    // 3. Populate default tags for matching categories
    console.log('[3/4] Checking and creating default category tags...');
    for (const cat of categories) {
      const templateList = DEFAULT_CATEGORY_TAGS[cat.name] || [
        { name: `${cat.name} General`, subcategory: 'General', description: `Standard ${cat.name} services` }
      ];

      for (let i = 0; i < templateList.length; i++) {
        const item = templateList[i];
        const existing = await ServiceTag.findOne({
          category: cat._id,
          name: item.name,
          isArchived: false
        });

        if (!existing) {
          const slug = item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          await ServiceTag.create({
            name: item.name,
            slug,
            category: cat._id,
            subcategory: {
              name: item.subcategory,
              slug: item.subcategory.toLowerCase().replace(/[^a-z0-9]+/g, '-')
            },
            description: item.description,
            displayOrder: i + 1,
            isActive: true,
            isCustomerVisible: true,
            isArchived: false
          });
          createdTagsCount++;
        } else {
          existingTagsCount++;
        }
      }
    }
    console.log(`[OK] Created ${createdTagsCount} new tags (${existingTagsCount} already existed)`);

    // 4. Backward-compatible mapping for existing providers
    console.log('[4/4] Migrating existing providers to dynamic service tags...');
    const providers = await Provider.find({ isDeleted: { $ne: true } });
    let updatedProvidersCount = 0;

    for (const provider of providers) {
      const providerCatIds = (provider.categories || []).map((c) => String(c));
      if (providerCatIds.length === 0) continue;

      // Find all active tags belonging to this provider's categories
      const matchingTags = await ServiceTag.find({
        category: { $in: providerCatIds },
        isActive: true,
        isArchived: false
      }).lean();

      if (matchingTags.length === 0) continue;

      const existingTagIds = new Set(
        (provider.serviceTags || []).map((st) => String(st.tag))
      );

      let addedCount = 0;
      if (!provider.serviceTags) {
        provider.serviceTags = [];
      }

      matchingTags.forEach((tagDoc) => {
        if (!existingTagIds.has(String(tagDoc._id))) {
          provider.serviceTags.push({
            tag: tagDoc._id,
            approvalStatus: 'approved',
            isActive: true,
            basePrice: 0,
            pricingType: 'fixed',
            experienceYears: provider.experienceYears || 0,
            addedAt: new Date()
          });
          existingTagIds.add(String(tagDoc._id));
          addedCount++;
        }
      });

      if (addedCount > 0) {
        await provider.save();
        updatedProvidersCount++;
      }
    }

    console.log(`[OK] Safely updated ${updatedProvidersCount} existing provider profile(s) with matching tags`);
    console.log('=== SERVICE TAG MIGRATION COMPLETED SUCCESSFULLY ===');
  } catch (err) {
    console.error('[MIGRATION_ERROR]', err);
  } finally {
    await mongoose.disconnect();
    console.log('[OK] Disconnected from MongoDB Atlas');
  }
};

if (require.main === module) {
  runMigration();
}

module.exports = runMigration;
