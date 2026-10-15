const Service = require('../models/Service');
const Category = require('../models/Category');
const Booking = require('../models/Booking');
const Provider = require('../models/Provider');

/**
 * Helper to escape special regex characters for case-insensitive matching
 */
const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Public: List active services for customer/provider discovery
 * Supports category filtering, search, pricing model filter, and sorting
 */
const getPublicServices = async (query = {}) => {
  const filter = { isActive: true };

  // Category filter
  if (query.category) {
    filter.category = query.category;
  }

  // Price type filter
  if (query.priceType) {
    filter.priceType = query.priceType;
  }

  // Price range filters
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.price = {};
    if (query.minPrice !== undefined && !Number.isNaN(Number(query.minPrice))) {
      filter.price.$gte = Number(query.minPrice);
    }
    if (query.maxPrice !== undefined && !Number.isNaN(Number(query.maxPrice))) {
      filter.price.$lte = Number(query.maxPrice);
    }
  }

  // Search filter
  if (query.search && query.search.trim()) {
    const searchRegex = new RegExp(escapeRegex(query.search.trim()), 'i');
    filter.$or = [{ name: searchRegex }, { description: searchRegex }];
  }

  // Sorting
  let sortOption = { name: 1 };
  if (query.sort === 'price_asc') {
    sortOption = { price: 1 };
  } else if (query.sort === 'price_desc') {
    sortOption = { price: -1 };
  } else if (query.sort === 'newest') {
    sortOption = { createdAt: -1 };
  }

  const services = await Service.find(filter)
    .populate('category', 'name slug icon isActive')
    .sort(sortOption)
    .lean();

  // Exclude services whose parent category is inactive or missing
  return services
    .filter((srv) => srv.category && srv.category.isActive)
    .map((srv) => ({
      ...srv,
      basePrice: srv.price,
      pricingType: srv.priceType || 'fixed'
    }));
};

/**
 * Admin: List services with pagination, filters, and booking reference counts
 */
const getAdminServices = async (query = {}) => {
  const filter = {};

  // Status filter
  if (query.status === 'active') {
    filter.isActive = true;
  } else if (query.status === 'inactive') {
    filter.isActive = false;
  }

  // Category filter
  if (query.category) {
    filter.category = query.category;
  }

  // Price type filter
  if (query.priceType) {
    filter.priceType = query.priceType;
  }

  // Search filter
  if (query.search && query.search.trim()) {
    const searchRegex = new RegExp(escapeRegex(query.search.trim()), 'i');
    filter.$or = [{ name: searchRegex }, { description: searchRegex }];
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const [services, total] = await Promise.all([
    Service.find(filter)
      .populate('category', 'name slug icon isActive')
      .populate('provider', 'businessName rating')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Service.countDocuments(filter)
  ]);

  // Aggregate booking references for each service in the page
  const serviceIds = services.map((s) => s._id);
  const bookingCounts = await Booking.aggregate([
    { $match: { service: { $in: serviceIds } } },
    { $group: { _id: '$service', count: { $sum: 1 } } }
  ]);

  const bookingCountMap = {};
  bookingCounts.forEach((bc) => {
    bookingCountMap[bc._id.toString()] = bc.count;
  });

  const servicesWithBookingCounts = services.map((srv) => ({
    ...srv,
    bookingsCount: bookingCountMap[srv._id.toString()] || 0
  }));

  return {
    services: servicesWithBookingCounts,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1
    }
  };
};

/**
 * Retrieve single service details by ID
 */
const getServiceById = async (serviceId) => {
  const service = await Service.findById(serviceId)
    .populate('category', 'name slug icon isActive description')
    .populate('provider', 'businessName rating experienceYears')
    .lean();

  if (!service) {
    const err = new Error(`Service not found with ID '${serviceId}'`);
    err.statusCode = 404;
    throw err;
  }

  const bookingsCount = await Booking.countDocuments({ service: service._id });
  return {
    ...service,
    basePrice: service.price,
    pricingType: service.priceType || 'fixed',
    bookingsCount
  };
};

/**
 * Admin: Create Service
 */
const createService = async (data) => {
  const {
    name,
    category: categoryId,
    provider: providerId,
    description,
    price,
    priceType = 'fixed',
    estimatedDurationMinutes = 60,
    image,
    isActive = true
  } = data;

  // Validate category existence
  const category = await Category.findById(categoryId);
  if (!category) {
    const err = new Error(`Category not found with ID '${categoryId}'`);
    err.statusCode = 404;
    throw err;
  }

  // If service is created as active, category must also be active
  if (isActive && !category.isActive) {
    const err = new Error(
      `Cannot create an active service in inactive category '${category.name}'. Please activate the category first or save the service as inactive.`
    );
    err.statusCode = 400;
    throw err;
  }

  // Validate provider if provided
  if (providerId) {
    const provider = await Provider.findById(providerId);
    if (!provider) {
      const err = new Error(`Provider not found with ID '${providerId}'`);
      err.statusCode = 404;
      throw err;
    }
  }

  // Duplicate service name check within the same category
  const existingService = await Service.findOne({
    category: categoryId,
    name: { $regex: new RegExp(`^${escapeRegex(name.trim())}$`, 'i') }
  });

  if (existingService) {
    const err = new Error(
      `A service with name '${name.trim()}' already exists in category '${category.name}'`
    );
    err.statusCode = 409;
    throw err;
  }

  // Pricing rule verification
  if ((priceType === 'fixed' || priceType === 'hourly') && price <= 0) {
    const err = new Error(`Price must be greater than 0 for ${priceType} pricing model`);
    err.statusCode = 400;
    throw err;
  }

  const newService = await Service.create({
    name: name.trim(),
    category: categoryId,
    provider: providerId || null,
    description: description !== undefined ? description.trim() : '',
    price: Number(price),
    priceType,
    estimatedDurationMinutes: Number(estimatedDurationMinutes) || 60,
    image: image ? image.trim() : null,
    isActive: Boolean(isActive)
  });

  const populatedService = await Service.findById(newService._id)
    .populate('category', 'name slug icon isActive')
    .populate('provider', 'businessName rating')
    .lean();

  return {
    ...populatedService,
    bookingsCount: 0
  };
};

/**
 * Admin: Update Service
 */
const updateService = async (serviceId, data) => {
  const service = await Service.findById(serviceId);
  if (!service) {
    const err = new Error(`Service not found with ID '${serviceId}'`);
    err.statusCode = 404;
    throw err;
  }

  const targetCategoryId = data.category || service.category;
  const targetCategory = await Category.findById(targetCategoryId);
  if (!targetCategory) {
    const err = new Error(`Category not found with ID '${targetCategoryId}'`);
    err.statusCode = 404;
    throw err;
  }

  const targetIsActive = data.isActive !== undefined ? Boolean(data.isActive) : service.isActive;
  if (targetIsActive && !targetCategory.isActive) {
    const err = new Error(
      `Cannot set service to active while category '${targetCategory.name}' is inactive. Activate the category first.`
    );
    err.statusCode = 400;
    throw err;
  }

  // Check duplicate service name in the target category (excluding this service)
  const targetName = data.name ? data.name.trim() : service.name;
  const existingService = await Service.findOne({
    _id: { $ne: serviceId },
    category: targetCategoryId,
    name: { $regex: new RegExp(`^${escapeRegex(targetName)}$`, 'i') }
  });

  if (existingService) {
    const err = new Error(
      `A service with name '${targetName}' already exists in category '${targetCategory.name}'`
    );
    err.statusCode = 409;
    throw err;
  }

  // Check provider if updating
  if (data.provider !== undefined && data.provider !== null) {
    const provider = await Provider.findById(data.provider);
    if (!provider) {
      const err = new Error(`Provider not found with ID '${data.provider}'`);
      err.statusCode = 404;
      throw err;
    }
  }

  // Pricing business rule
  const effectivePriceType = data.priceType || service.priceType;
  const effectivePrice = data.price !== undefined ? Number(data.price) : service.price;
  if ((effectivePriceType === 'fixed' || effectivePriceType === 'hourly') && effectivePrice <= 0) {
    const err = new Error(`Price must be greater than 0 for ${effectivePriceType} pricing model`);
    err.statusCode = 400;
    throw err;
  }

  // Apply updates
  if (data.name !== undefined) service.name = data.name.trim();
  if (data.category !== undefined) service.category = targetCategoryId;
  if (data.provider !== undefined) service.provider = data.provider || null;
  if (data.description !== undefined) service.description = data.description.trim();
  if (data.price !== undefined) service.price = Number(data.price);
  if (data.priceType !== undefined) service.priceType = data.priceType;
  if (data.estimatedDurationMinutes !== undefined) {
    service.estimatedDurationMinutes = Number(data.estimatedDurationMinutes);
  }
  if (data.image !== undefined) service.image = data.image ? data.image.trim() : null;
  if (data.isActive !== undefined) service.isActive = Boolean(data.isActive);

  await service.save();

  const [populatedService, bookingsCount] = await Promise.all([
    Service.findById(service._id)
      .populate('category', 'name slug icon isActive')
      .populate('provider', 'businessName rating')
      .lean(),
    Booking.countDocuments({ service: service._id })
  ]);

  return {
    ...populatedService,
    bookingsCount
  };
};

/**
 * Admin: Update service active status
 */
const updateServiceStatus = async (serviceId, isActive) => {
  const service = await Service.findById(serviceId);
  if (!service) {
    const err = new Error(`Service not found with ID '${serviceId}'`);
    err.statusCode = 404;
    throw err;
  }

  if (isActive) {
    const category = await Category.findById(service.category);
    if (category && !category.isActive) {
      const err = new Error(
        `Cannot activate service '${service.name}' because its category '${category.name}' is inactive. Activate the category first.`
      );
      err.statusCode = 400;
      throw err;
    }
  }

  service.isActive = Boolean(isActive);
  await service.save();

  const [populatedService, bookingsCount] = await Promise.all([
    Service.findById(service._id)
      .populate('category', 'name slug icon isActive')
      .populate('provider', 'businessName rating')
      .lean(),
    Booking.countDocuments({ service: service._id })
  ]);

  return {
    ...populatedService,
    bookingsCount
  };
};

/**
 * Admin: Delete service
 * Refuses deletion if referenced by existing bookings, returning 409 conflict
 */
const deleteService = async (serviceId) => {
  const service = await Service.findById(serviceId);
  if (!service) {
    const err = new Error(`Service not found with ID '${serviceId}'`);
    err.statusCode = 404;
    throw err;
  }

  // Check if any bookings reference this service
  const bookingsCount = await Booking.countDocuments({ service: service._id });
  if (bookingsCount > 0) {
    const err = new Error(
      `Cannot delete service '${service.name}' because it is currently referenced by ${bookingsCount} booking(s). Deactivate the service instead to preserve historical records.`
    );
    err.statusCode = 409;
    err.data = { bookingsCount, canDeactivate: true };
    throw err;
  }

  await Service.findByIdAndDelete(serviceId);
  return {
    deletedId: serviceId,
    name: service.name
  };
};

module.exports = {
  getPublicServices,
  getAdminServices,
  getServiceById,
  createService,
  updateService,
  updateServiceStatus,
  deleteService
};
