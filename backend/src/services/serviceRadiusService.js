const mongoose = require('mongoose');
const { ServiceRadiusConfig, Category, Provider, Service } = require('../models');

/**
 * Default sample radius options matching system requirements
 */
const DEFAULT_CATEGORY_RADII = {
  electrician: { radii: [2, 5, 8], maxKm: 12 },
  plumber: { radii: [3, 5, 10], maxKm: 15 },
  'ac-service': { radii: [5, 8, 12], maxKm: 20 },
  carpenter: { radii: [2, 5, 15], maxKm: 20 },
  painter: { radii: [5, 10, 20], maxKm: 25 },
  'ro-water-purifier-repair': { radii: [3, 5, 8], maxKm: 12 },
  'washing-machine-repair': { radii: [3, 5, 10], maxKm: 15 },
  'bike-car-mechanic': { radii: [5, 10, 15], maxKm: 25 },
  'womens-beauty-services': { radii: [3, 5, 10], maxKm: 15 }
};

/**
 * Seed or auto-initialize default radius configurations for all active categories
 */
const seedDefaultRadiusConfigs = async () => {
  const categories = await Category.find({ isActive: true }).lean();
  const created = [];

  for (const cat of categories) {
    const existing = await ServiceRadiusConfig.findOne({ category: cat._id });
    if (!existing) {
      const slug = cat.slug || String(cat.name).toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const preset = DEFAULT_CATEGORY_RADII[slug] || { radii: [2, 5, 10], maxKm: 15 };

      const doc = await ServiceRadiusConfig.create({
        category: cat._id,
        serviceName: cat.name,
        allowedRadii: preset.radii.map((km) => ({ km, isActive: true })),
        maxRadiusKm: preset.maxKm,
        isActive: true
      });
      created.push(doc);
    }
  }

  return created;
};

/**
 * Get provider usage counts for each radius option of a service category
 */
const enrichWithProviderCounts = async (configs) => {
  if (!configs || configs.length === 0) return [];

  // Group all providers by category and radiusKm
  const activeProviders = await Provider.find({
    isDeleted: { $ne: true },
    'serviceAreasConfig.0': { $exists: true }
  })
    .select('serviceAreasConfig businessName user')
    .lean();

  const usageMap = {}; // `${categoryId}:${km}` => count

  for (const p of activeProviders) {
    if (Array.isArray(p.serviceAreasConfig)) {
      for (const area of p.serviceAreasConfig) {
        if (area.isActive !== false && area.category && area.radiusKm) {
          const key = `${area.category.toString()}:${Number(area.radiusKm)}`;
          usageMap[key] = (usageMap[key] || 0) + 1;
        }
      }
    }
  }

  return configs.map((cfg) => {
    const cfgObj = cfg.toObject ? cfg.toObject() : { ...cfg };
    const catIdStr = (cfgObj.category?._id || cfgObj.category || '').toString();

    let totalConfigProviders = 0;
    cfgObj.allowedRadii = (cfgObj.allowedRadii || []).map((rad) => {
      const count = usageMap[`${catIdStr}:${Number(rad.km)}`] || 0;
      totalConfigProviders += count;
      return {
        ...rad,
        providerCount: count
      };
    });

    cfgObj.totalProvidersCount = totalConfigProviders;
    return cfgObj;
  });
};

/**
 * List all service radius configurations
 */
const listRadiusConfigs = async (query = {}) => {
  // Ensure default seeds exist
  const existingCount = await ServiceRadiusConfig.countDocuments();
  if (existingCount === 0) {
    await seedDefaultRadiusConfigs();
  }

  const filter = {};
  if (query.isActive !== undefined && query.isActive !== 'all') {
    filter.isActive = String(query.isActive) === 'true';
  }
  if (query.category) {
    filter.category = query.category;
  }

  const configs = await ServiceRadiusConfig.find(filter)
    .populate('category', 'name slug icon image isActive')
    .sort({ serviceName: 1 })
    .lean();

  return await enrichWithProviderCounts(configs);
};

/**
 * Get single radius config by ID
 */
const getRadiusConfigById = async (id) => {
  const config = await ServiceRadiusConfig.findById(id)
    .populate('category', 'name slug icon image isActive')
    .lean();

  if (!config) {
    const err = new Error('Service radius configuration not found');
    err.statusCode = 404;
    throw err;
  }

  const [enriched] = await enrichWithProviderCounts([config]);
  return enriched;
};

/**
 * Get radius config for a category (used by provider app & booking validation)
 */
const getRadiusConfigByCategory = async (categoryId) => {
  if (!categoryId) return null;

  let config = await ServiceRadiusConfig.findOne({ category: categoryId, isActive: true })
    .populate('category', 'name slug icon image isActive')
    .lean();

  if (!config) {
    // If not yet explicitly created, seed for this category if active
    const category = await Category.findById(categoryId).lean();
    if (category) {
      const slug = category.slug || String(category.name).toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const preset = DEFAULT_CATEGORY_RADII[slug] || { radii: [2, 5, 10], maxKm: 15 };

      config = await ServiceRadiusConfig.create({
        category: category._id,
        serviceName: category.name,
        allowedRadii: preset.radii.map((km) => ({ km, isActive: true })),
        maxRadiusKm: preset.maxKm,
        isActive: true
      });
      config = await ServiceRadiusConfig.findById(config._id).populate('category').lean();
    }
  }

  return config;
};

/**
 * Admin creates radius config for a service/category
 */
const createRadiusConfig = async (data) => {
  const { categoryId, allowedRadii, maxRadiusKm, isActive = true } = data;

  if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) {
    const err = new Error('Valid category ID is required');
    err.statusCode = 400;
    throw err;
  }

  const category = await Category.findById(categoryId);
  if (!category) {
    const err = new Error('Category not found');
    err.statusCode = 404;
    throw err;
  }

  const existing = await ServiceRadiusConfig.findOne({ category: categoryId });
  if (existing) {
    const err = new Error(`Service radius configuration already exists for '${category.name}'`);
    err.statusCode = 400;
    throw err;
  }

  const numMax = Number(maxRadiusKm);
  if (isNaN(numMax) || numMax <= 0) {
    const err = new Error('Maximum permitted radius must be a positive number greater than 0 KM');
    err.statusCode = 400;
    throw err;
  }

  if (!Array.isArray(allowedRadii) || allowedRadii.length === 0) {
    const err = new Error('At least one allowed radius option is required');
    err.statusCode = 400;
    throw err;
  }

  const cleanRadii = [];
  for (const item of allowedRadii) {
    const km = typeof item === 'object' ? Number(item.km) : Number(item);
    if (isNaN(km) || km <= 0) {
      const err = new Error('Radius option must be a positive number greater than 0 KM');
      err.statusCode = 400;
      throw err;
    }
    if (km > numMax) {
      const err = new Error(`Radius option ${km} KM cannot exceed maximum permitted radius of ${numMax} KM`);
      err.statusCode = 400;
      throw err;
    }
    if (!cleanRadii.some((r) => r.km === km)) {
      cleanRadii.push({
        km,
        isActive: typeof item === 'object' && item.isActive !== undefined ? Boolean(item.isActive) : true
      });
    }
  }

  cleanRadii.sort((a, b) => a.km - b.km);

  const config = await ServiceRadiusConfig.create({
    category: category._id,
    serviceName: category.name,
    allowedRadii: cleanRadii,
    maxRadiusKm: numMax,
    isActive: Boolean(isActive)
  });

  return await getRadiusConfigById(config._id);
};

/**
 * Admin updates radius config (max radius, status, allowed radii)
 */
const updateRadiusConfig = async (id, data) => {
  const config = await ServiceRadiusConfig.findById(id);
  if (!config) {
    const err = new Error('Service radius configuration not found');
    err.statusCode = 404;
    throw err;
  }

  if (data.maxRadiusKm !== undefined) {
    const numMax = Number(data.maxRadiusKm);
    if (isNaN(numMax) || numMax <= 0) {
      const err = new Error('Maximum permitted radius must be a positive number greater than 0 KM');
      err.statusCode = 400;
      throw err;
    }
    config.maxRadiusKm = numMax;
  }

  if (data.isActive !== undefined) {
    config.isActive = Boolean(data.isActive);
  }

  if (Array.isArray(data.allowedRadii)) {
    const cleanRadii = [];
    for (const item of data.allowedRadii) {
      const km = typeof item === 'object' ? Number(item.km) : Number(item);
      if (isNaN(km) || km <= 0) {
        const err = new Error('Radius option must be a positive number greater than 0 KM');
        err.statusCode = 400;
        throw err;
      }
      if (km > config.maxRadiusKm) {
        const err = new Error(
          `Radius option ${km} KM cannot exceed maximum permitted radius of ${config.maxRadiusKm} KM`
        );
        err.statusCode = 400;
        throw err;
      }
      if (!cleanRadii.some((r) => r.km === km)) {
        cleanRadii.push({
          km,
          isActive: typeof item === 'object' && item.isActive !== undefined ? Boolean(item.isActive) : true
        });
      }
    }
    cleanRadii.sort((a, b) => a.km - b.km);
    config.allowedRadii = cleanRadii;
  }

  await config.save();
  return await getRadiusConfigById(config._id);
};

/**
 * Add a new radius option (KM) to a service
 */
const addRadiusOption = async (id, payload) => {
  const config = await ServiceRadiusConfig.findById(id);
  if (!config) {
    const err = new Error('Service radius configuration not found');
    err.statusCode = 404;
    throw err;
  }

  const km =
    typeof payload === 'object' && payload !== null
      ? Number(payload.km !== undefined ? payload.km : payload.radiusKm)
      : Number(payload);

  if (isNaN(km) || km <= 0) {
    const err = new Error('Radius must be a positive number greater than 0 KM');
    err.statusCode = 400;
    throw err;
  }

  if (km > config.maxRadiusKm) {
    const err = new Error(`Radius option ${km} KM cannot exceed maximum permitted radius of ${config.maxRadiusKm} KM`);
    err.statusCode = 400;
    throw err;
  }

  const exists = config.allowedRadii.some((r) => r.km === km);
  if (exists) {
    const err = new Error(`Radius option ${km} KM is already configured for this service`);
    err.statusCode = 400;
    throw err;
  }

  config.allowedRadii.push({
    km,
    isActive: typeof payload === 'object' && payload?.isActive !== undefined ? Boolean(payload.isActive) : true
  });
  config.allowedRadii.sort((a, b) => a.km - b.km);

  await config.save();
  return await getRadiusConfigById(config._id);
};

/**
 * Toggle enable/disable a specific radius option
 */
const toggleRadiusOption = async (id, radiusIdOrKm, isActive) => {
  const config = await ServiceRadiusConfig.findById(id);
  if (!config) {
    const err = new Error('Service radius configuration not found');
    err.statusCode = 404;
    throw err;
  }

  let radiusOption = null;
  if (mongoose.Types.ObjectId.isValid(radiusIdOrKm)) {
    radiusOption = config.allowedRadii.id(radiusIdOrKm);
  }
  if (!radiusOption) {
    const targetKm = Number(radiusIdOrKm);
    if (!isNaN(targetKm)) {
      radiusOption = config.allowedRadii.find((r) => r.km === targetKm);
    }
  }

  if (!radiusOption) {
    const err = new Error('Radius option not found');
    err.statusCode = 404;
    throw err;
  }

  radiusOption.isActive = isActive !== undefined ? Boolean(isActive) : !radiusOption.isActive;
  await config.save();
  return await getRadiusConfigById(config._id);
};

/**
 * Delete an unused radius option
 * If option is currently in use by any provider, reject deletion with an informative message
 */
const deleteRadiusOption = async (id, radiusId) => {
  const config = await ServiceRadiusConfig.findById(id);
  if (!config) {
    const err = new Error('Service radius configuration not found');
    err.statusCode = 404;
    throw err;
  }

  const radiusOption = config.allowedRadii.id(radiusId);
  if (!radiusOption) {
    const err = new Error('Radius option not found');
    err.statusCode = 404;
    throw err;
  }

  // Check if any provider has selected this radius option for this category
  const inUseCount = await Provider.countDocuments({
    isDeleted: { $ne: true },
    serviceAreasConfig: {
      $elemMatch: {
        category: config.category,
        radiusKm: radiusOption.km
      }
    }
  });

  if (inUseCount > 0) {
    const err = new Error(
      `Cannot delete ${radiusOption.km} KM radius option because ${inUseCount} provider(s) are actively using it. You can disable this option instead to prevent future selections.`
    );
    err.statusCode = 409;
    throw err;
  }

  config.allowedRadii.pull(radiusId);
  if (config.allowedRadii.length === 0) {
    const err = new Error('A service must have at least one radius option configured');
    err.statusCode = 400;
    throw err;
  }

  await config.save();
  return await getRadiusConfigById(config._id);
};

/**
 * View providers who have selected a specific radius for a service category
 */
const getProvidersByRadius = async (id, query = {}) => {
  const config = await ServiceRadiusConfig.findById(id).populate('category').lean();
  if (!config) {
    const err = new Error('Service radius configuration not found');
    err.statusCode = 404;
    throw err;
  }

  const filter = {
    isDeleted: { $ne: true },
    'serviceAreasConfig.category': config.category._id
  };

  if (query.km !== undefined && query.km !== 'all') {
    filter['serviceAreasConfig.radiusKm'] = Number(query.km);
  }

  const providers = await Provider.find(filter)
    .populate('user', 'name phone email avatar isActive')
    .lean();

  const results = [];
  for (const p of providers) {
    const matchedArea = (p.serviceAreasConfig || []).find(
      (a) => a.category?.toString() === config.category._id.toString() &&
             (query.km === undefined || query.km === 'all' || Number(a.radiusKm) === Number(query.km))
    );

    if (matchedArea) {
      results.push({
        providerId: p._id,
        businessName: p.businessName || p.user?.name || 'Provider',
        user: p.user,
        verificationStatus: p.verificationStatus,
        isAvailable: p.isAvailable,
        serviceArea: matchedArea
      });
    }
  }

  return {
    config,
    providers: results,
    total: results.length
  };
};

/**
 * Delete entire service radius config
 */
const deleteRadiusConfig = async (id) => {
  const config = await ServiceRadiusConfig.findById(id);
  if (!config) {
    const err = new Error('Service radius configuration not found');
    err.statusCode = 404;
    throw err;
  }

  await ServiceRadiusConfig.deleteOne({ _id: id });
  return { success: true, message: `Service radius configuration for '${config.serviceName}' deleted successfully` };
};

module.exports = {
  seedDefaultRadiusConfigs,
  listRadiusConfigs,
  getRadiusConfigById,
  getRadiusConfigByCategory,
  createRadiusConfig,
  updateRadiusConfig,
  addRadiusOption,
  toggleRadiusOption,
  deleteRadiusOption,
  getProvidersByRadius,
  deleteRadiusConfig
};
