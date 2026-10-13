const mongoose = require('mongoose');
require('dotenv').config();

async function seedCategories() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Category = require('../models/Category');
  
  const count = await Category.countDocuments();
  if (count === 0) {
    console.log('Seeding baseline categories with Quick Services and Popular Services configured...');
    const initial = [
      {
        name: 'Electrician',
        slug: 'electrician',
        description: 'Repairs & Fittings',
        icon: 'flash-outline',
        showInQuickServices: true,
        quickServicesOrder: 1,
        showInPopularServices: true,
        popularServicesOrder: 1,
        isActive: true
      },
      {
        name: 'Mechanic',
        slug: 'mechanic',
        description: 'Quick Emergency',
        icon: 'construct-outline',
        showInQuickServices: true,
        quickServicesOrder: 2,
        showInPopularServices: false,
        popularServicesOrder: 0,
        isActive: true
      },
      {
        name: 'Plumber',
        slug: 'plumber',
        description: 'Leaks & Pipework',
        icon: 'water-outline',
        showInQuickServices: true,
        quickServicesOrder: 3,
        showInPopularServices: false,
        popularServicesOrder: 0,
        isActive: true
      },
      {
        name: 'AC Service',
        slug: 'ac-service',
        description: 'Repair & Cleaning',
        icon: 'snow-outline',
        showInQuickServices: true,
        quickServicesOrder: 4,
        showInPopularServices: true,
        popularServicesOrder: 2,
        isActive: true
      },
      {
        name: 'Bike Service',
        slug: 'bike-service',
        description: 'Two wheeler inspection & repair',
        icon: 'bicycle-outline',
        showInQuickServices: false,
        quickServicesOrder: 0,
        showInPopularServices: true,
        popularServicesOrder: 3,
        isActive: true
      }
    ];

    await Category.insertMany(initial);
    console.log('✓ Successfully seeded baseline categories in MongoDB!');
  } else {
    console.log(`Categories already exist in MongoDB (count: ${count}).`);
  }
  process.exit(0);
}

seedCategories().catch(e => {
  console.error(e);
  process.exit(1);
});
