const Category = require('../models/Category');
const Service = require('../models/Service');
const { slugify } = require('../utils/slugify');

/**
 * Generate a unique slug for a Category.
 * If baseSlug exists, appends numbers: baseSlug-1, baseSlug-2, etc.
 */
const generateUniqueSlug = async (name, existingId = null, customSlug = null) => {
  const baseSlug = slugify(customSlug || name);
  if (!baseSlug) {
    const err = new Error('Category name or slug must contain alphanumeric characters');
    err.statusCode = 400;
    throw err;
  }

  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const query = { slug };
    if (existingId) {
      query._id = { $ne: existingId };
    }

    const existing = await Category.findOne(query);
    if (!existing) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
};

/**
 * Public: List active categories for customers/providers
 * Supports optional search, quickServices/popularServices filtering, sort by section order, displayOrder, name
 */
const getPublicCategories = async (query = {}) => {
  const filter = { isActive: true };

  // Quick Services filter
  if (query.quickServices === 'true' || query.quickServices === true) {
    filter.showInQuickServices = true;
  }

  // Popular Services filter
  if (query.popularServices === 'true' || query.popularServices === true) {
    filter.showInPopularServices = true;
  }

  if (query.search && query.search.trim()) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [{ name: searchRegex }, { description: searchRegex }];
  }

  // Sorting
  let sortOption = { displayOrder: 1, name: 1 };
  if (query.quickServices === 'true' || query.quickServices === true) {
    sortOption = { quickServicesOrder: 1, displayOrder: 1, name: 1 };
  } else if (query.popularServices === 'true' || query.popularServices === true) {
    sortOption = { popularServicesOrder: 1, displayOrder: 1, name: 1 };
  }

  const queryBuilder = Category.find(filter)
    .select('name slug description icon image isActive displayOrder showInQuickServices quickServicesOrder showInPopularServices popularServicesOrder')
    .sort(sortOption);

  if (query.limit && !Number.isNaN(Number(query.limit))) {
    queryBuilder.limit(Math.max(1, parseInt(query.limit, 10)));
  }

  const categories = await queryBuilder.lean();
  return categories;
};

/**
 * Admin: List all categories (active & inactive) with service count
 * Supports pagination, search, status filtering, and sorting
 */
const getAdminCategories = async (query = {}) => {
  const filter = {};

  if (query.status === 'active') {
    filter.isActive = true;
  } else if (query.status === 'inactive') {
    filter.isActive = false;
  }

  if (query.search && query.search.trim()) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [
      { name: searchRegex },
      { slug: searchRegex },
      { description: searchRegex }
    ];
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const [categories, total] = await Promise.all([
    Category.find(filter)
      .sort({ displayOrder: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Category.countDocuments(filter)
  ]);

  // Aggregate service counts for each category
  const categoryIds = categories.map((c) => c._id);
  const serviceCounts = await Service.aggregate([
    { $match: { category: { $in: categoryIds } } },
    { $group: { _id: '$category', count: { $sum: 1 } } }
  ]);

  const serviceCountMap = {};
  serviceCounts.forEach((sc) => {
    serviceCountMap[sc._id.toString()] = sc.count;
  });

  const categoriesWithCounts = categories.map((cat) => ({
    ...cat,
    servicesCount: serviceCountMap[cat._id.toString()] || 0
  }));

  return {
    categories: categoriesWithCounts,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1
    }
  };
};

/**
 * Get category by ID
 */
const getCategoryById = async (categoryId) => {
  const category = await Category.findById(categoryId).lean();
  if (!category) {
    const err = new Error('Category not found');
    err.statusCode = 404;
    throw err;
  }

  const servicesCount = await Service.countDocuments({ category: category._id });
  return {
    ...category,
    servicesCount
  };
};

/**
 * Admin: Create Category
 */
const createCategory = async (data) => {
  const {
    name,
    slug: providedSlug,
    description,
    icon,
    image,
    isActive,
    displayOrder,
    showInQuickServices,
    quickServicesOrder,
    showInPopularServices,
    popularServicesOrder
  } = data;

  // Check duplicate name
  const existingName = await Category.findOne({ name: name.trim() });
  if (existingName) {
    const err = new Error(`Category with name '${name.trim()}' already exists`);
    err.statusCode = 409;
    throw err;
  }

  // Generate unique slug
  const finalSlug = await generateUniqueSlug(name, null, providedSlug);

  const category = await Category.create({
    name: name.trim(),
    slug: finalSlug,
    description: description !== undefined ? description.trim() : '',
    icon: icon ? icon.trim() : null,
    image: image ? image.trim() : null,
    isActive: isActive !== undefined ? Boolean(isActive) : true,
    displayOrder: Number.isFinite(Number(displayOrder)) ? Number(displayOrder) : 0,
    showInQuickServices: showInQuickServices !== undefined ? Boolean(showInQuickServices) : false,
    quickServicesOrder: Number.isFinite(Number(quickServicesOrder)) ? Number(quickServicesOrder) : 0,
    showInPopularServices: showInPopularServices !== undefined ? Boolean(showInPopularServices) : false,
    popularServicesOrder: Number.isFinite(Number(popularServicesOrder)) ? Number(popularServicesOrder) : 0
  });

  return category.toObject();
};

/**
 * Admin: Update Category
 */
const updateCategory = async (categoryId, data) => {
  const category = await Category.findById(categoryId);
  if (!category) {
    const err = new Error('Category not found');
    err.statusCode = 404;
    throw err;
  }

  const {
    name,
    slug: providedSlug,
    description,
    icon,
    image,
    isActive,
    displayOrder,
    showInQuickServices,
    quickServicesOrder,
    showInPopularServices,
    popularServicesOrder
  } = data;

  if (name && name.trim()) {
    const existingName = await Category.findOne({
      name: name.trim(),
      _id: { $ne: categoryId }
    });
    if (existingName) {
      const err = new Error(`Category with name '${name.trim()}' already exists`);
      err.statusCode = 409;
      throw err;
    }
    category.name = name.trim();
  }

  // Update slug if explicitly changed or if name changed and slug was omitted
  if (providedSlug !== undefined || name) {
    const targetSlug = providedSlug !== undefined ? providedSlug : category.slug;
    category.slug = await generateUniqueSlug(category.name, categoryId, targetSlug);
  }

  if (description !== undefined) category.description = description.trim();
  if (icon !== undefined) category.icon = icon ? icon.trim() : null;
  if (image !== undefined) category.image = image ? image.trim() : null;
  if (isActive !== undefined) category.isActive = Boolean(isActive);
  if (displayOrder !== undefined && Number.isFinite(Number(displayOrder))) {
    category.displayOrder = Number(displayOrder);
  }
  if (showInQuickServices !== undefined) {
    category.showInQuickServices = Boolean(showInQuickServices);
  }
  if (quickServicesOrder !== undefined && Number.isFinite(Number(quickServicesOrder))) {
    category.quickServicesOrder = Number(quickServicesOrder);
  }
  if (showInPopularServices !== undefined) {
    category.showInPopularServices = Boolean(showInPopularServices);
  }
  if (popularServicesOrder !== undefined && Number.isFinite(Number(popularServicesOrder))) {
    category.popularServicesOrder = Number(popularServicesOrder);
  }

  await category.save();

  const servicesCount = await Service.countDocuments({ category: category._id });
  return {
    ...category.toObject(),
    servicesCount
  };
};

/**
 * Admin: Update category active status
 */
const updateCategoryStatus = async (categoryId, isActive) => {
  const category = await Category.findById(categoryId);
  if (!category) {
    const err = new Error('Category not found');
    err.statusCode = 404;
    throw err;
  }

  category.isActive = Boolean(isActive);
  await category.save();

  const servicesCount = await Service.countDocuments({ category: category._id });
  return {
    ...category.toObject(),
    servicesCount
  };
};

/**
 * Admin: Delete category
 * Refuses deletion if referenced by existing services; returns conflict and guidance.
 */
const deleteCategory = async (categoryId) => {
  const category = await Category.findById(categoryId);
  if (!category) {
    const err = new Error('Category not found');
    err.statusCode = 404;
    throw err;
  }

  // Check if any services reference this category
  const servicesCount = await Service.countDocuments({ category: category._id });
  if (servicesCount > 0) {
    const err = new Error(
      `Cannot delete category '${category.name}' because it is currently referenced by ${servicesCount} service(s). Deactivate the category instead or reassign the services.`
    );
    err.statusCode = 409;
    err.data = { servicesCount, canDeactivate: true };
    throw err;
  }

  await Category.findByIdAndDelete(categoryId);
  return {
    deletedId: categoryId,
    name: category.name
  };
};

module.exports = {
  getPublicCategories,
  getAdminCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  updateCategoryStatus,
  deleteCategory,
  generateUniqueSlug
};
