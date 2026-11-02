const mongoose = require('mongoose');
const { ServiceTag, Category, Provider, Booking, User, Service } = require('../models');

/**
 * Generate a URL-safe lowercase slug from a string
 */
const slugify = (text) => {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/**
 * Escape regex special characters
 */
const escapeRegex = (string) => {
  return String(string || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * 1. Admin / Public: List tags with filtering, pagination, and provider counts
 */
const listTags = async (query = {}) => {
  const {
    category,
    subcategory,
    search,
    isActive,
    isCustomerVisible,
    isArchived = 'false',
    page = 1,
    limit = 50,
    sort = 'displayOrder'
  } = query;

  const filter = {};

  if (isArchived === 'false' || isArchived === false) {
    filter.isArchived = { $ne: true };
  } else if (isArchived === 'true' || isArchived === true) {
    filter.isArchived = true;
  }

  if (category && category !== 'all') {
    if (mongoose.Types.ObjectId.isValid(category)) {
      filter.category = new mongoose.Types.ObjectId(category);
    } else {
      const cat = await Category.findOne({
        $or: [
          { name: new RegExp(`^${escapeRegex(category)}$`, 'i') },
          { slug: category.toLowerCase() }
        ]
      });
      if (cat) {
        filter.category = cat._id;
      } else {
        return { tags: [], pagination: { total: 0, page: 1, limit: Number(limit), pages: 0 } };
      }
    }
  }

  if (subcategory && subcategory !== 'all') {
    filter['subcategory.name'] = new RegExp(`^${escapeRegex(subcategory)}$`, 'i');
  }

  if (isActive !== undefined && isActive !== 'all') {
    filter.isActive = String(isActive) === 'true';
  }

  if (isCustomerVisible !== undefined && isCustomerVisible !== 'all') {
    filter.isCustomerVisible = String(isCustomerVisible) === 'true';
  }

  if (search && search.trim()) {
    const s = escapeRegex(search.trim());
    filter.$or = [
      { name: new RegExp(s, 'i') },
      { 'subcategory.name': new RegExp(s, 'i') },
      { description: new RegExp(s, 'i') }
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  let sortOption = { displayOrder: 1, name: 1 };
  if (sort === 'name') sortOption = { name: 1 };
  if (sort === 'createdAt-desc') sortOption = { createdAt: -1 };

  const [tags, total] = await Promise.all([
    ServiceTag.find(filter)
      .populate('category', 'name slug icon image isActive')
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    ServiceTag.countDocuments(filter)
  ]);

  // Aggregate active provider counts for these tags
  const tagIds = tags.map((t) => t._id);
  const providerCounts = await Provider.aggregate([
    { $match: { verificationStatus: 'verified', isDeleted: { $ne: true } } },
    { $unwind: '$serviceTags' },
    {
      $match: {
        'serviceTags.tag': { $in: tagIds },
        'serviceTags.isActive': true,
        'serviceTags.approvalStatus': 'approved'
      }
    },
    {
      $group: {
        _id: '$serviceTags.tag',
        count: { $sum: 1 }
      }
    }
  ]);

  const countMap = {};
  providerCounts.forEach((c) => {
    countMap[String(c._id)] = c.count;
  });

  const tagsWithCounts = tags.map((t) => ({
    ...t,
    providerCount: countMap[String(t._id)] || 0
  }));

  return {
    tags: tagsWithCounts,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum)
    }
  };
};

/**
 * 2. Get Single Tag Details
 */
const getTagById = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const err = new Error('Invalid tag ID');
    err.statusCode = 400;
    throw err;
  }

  const tag = await ServiceTag.findById(id).populate('category', 'name slug icon image isActive').lean();
  if (!tag) {
    const err = new Error('Service tag not found');
    err.statusCode = 404;
    throw err;
  }

  const providerCount = await Provider.countDocuments({
    verificationStatus: 'verified',
    isDeleted: { $ne: true },
    serviceTags: {
      $elemMatch: {
        tag: tag._id,
        isActive: true,
        approvalStatus: 'approved'
      }
    }
  });

  return { ...tag, providerCount };
};

/**
 * 3. Admin: Create Tag
 */
const createTag = async (tagData) => {
  const {
    name,
    category,
    subcategoryName = 'General',
    description = '',
    icon = null,
    image = null,
    displayOrder = 0,
    isActive = true,
    isCustomerVisible = true
  } = tagData;

  if (!name || !name.trim()) {
    const err = new Error('Tag name is required');
    err.statusCode = 400;
    throw err;
  }

  if (!category || !mongoose.Types.ObjectId.isValid(category)) {
    const err = new Error('A valid category reference is required');
    err.statusCode = 400;
    throw err;
  }

  const catDoc = await Category.findById(category);
  if (!catDoc) {
    const err = new Error('Category not found');
    err.statusCode = 404;
    throw err;
  }

  const cleanName = name.trim();
  const cleanSubName = (subcategoryName || 'General').trim();
  const slug = slugify(cleanName);
  const subSlug = slugify(cleanSubName);

  // Check duplicate within the same category and subcategory
  const duplicate = await ServiceTag.findOne({
    category,
    'subcategory.name': new RegExp(`^${escapeRegex(cleanSubName)}$`, 'i'),
    name: new RegExp(`^${escapeRegex(cleanName)}$`, 'i'),
    isArchived: false
  });

  if (duplicate) {
    const err = new Error(`Tag '${cleanName}' already exists in subcategory '${cleanSubName}'`);
    err.statusCode = 409;
    throw err;
  }

  const tag = await ServiceTag.create({
    name: cleanName,
    slug,
    category,
    subcategory: {
      name: cleanSubName,
      slug: subSlug
    },
    description: description.trim(),
    icon,
    image,
    displayOrder: Number(displayOrder) || 0,
    isActive: Boolean(isActive),
    isCustomerVisible: Boolean(isCustomerVisible),
    isArchived: false
  });

  return tag.populate('category', 'name slug icon image isActive');
};

/**
 * 4. Admin: Update Tag
 */
const updateTag = async (id, updateData) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const err = new Error('Invalid tag ID');
    err.statusCode = 400;
    throw err;
  }

  const tag = await ServiceTag.findById(id);
  if (!tag) {
    const err = new Error('Service tag not found');
    err.statusCode = 404;
    throw err;
  }

  const categoryId = updateData.category || tag.category;
  const cleanName = updateData.name ? updateData.name.trim() : tag.name;
  const cleanSubName = updateData.subcategoryName
    ? updateData.subcategoryName.trim()
    : tag.subcategory?.name || 'General';

  // Check duplicate if name or subcategory changed
  if (
    cleanName.toLowerCase() !== tag.name.toLowerCase() ||
    cleanSubName.toLowerCase() !== (tag.subcategory?.name || '').toLowerCase() ||
    String(categoryId) !== String(tag.category)
  ) {
    const duplicate = await ServiceTag.findOne({
      _id: { $ne: tag._id },
      category: categoryId,
      'subcategory.name': new RegExp(`^${escapeRegex(cleanSubName)}$`, 'i'),
      name: new RegExp(`^${escapeRegex(cleanName)}$`, 'i'),
      isArchived: false
    });

    if (duplicate) {
      const err = new Error(`Another tag named '${cleanName}' already exists in this category/subcategory`);
      err.statusCode = 409;
      throw err;
    }
  }

  tag.name = cleanName;
  tag.slug = slugify(cleanName);
  tag.category = categoryId;
  tag.subcategory = {
    name: cleanSubName,
    slug: slugify(cleanSubName)
  };

  if (updateData.description !== undefined) tag.description = updateData.description.trim();
  if (updateData.icon !== undefined) tag.icon = updateData.icon;
  if (updateData.image !== undefined) tag.image = updateData.image;
  if (updateData.displayOrder !== undefined) tag.displayOrder = Number(updateData.displayOrder) || 0;
  if (updateData.isActive !== undefined) tag.isActive = Boolean(updateData.isActive);
  if (updateData.isCustomerVisible !== undefined) tag.isCustomerVisible = Boolean(updateData.isCustomerVisible);
  if (updateData.isArchived !== undefined) tag.isArchived = Boolean(updateData.isArchived);

  await tag.save();
  return tag.populate('category', 'name slug icon image isActive');
};

/**
 * 5. Admin: Update Tag Status (toggle active / customer visible)
 */
const updateTagStatus = async (id, statusData) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const err = new Error('Invalid tag ID');
    err.statusCode = 400;
    throw err;
  }

  const tag = await ServiceTag.findById(id);
  if (!tag) {
    const err = new Error('Service tag not found');
    err.statusCode = 404;
    throw err;
  }

  if (statusData.isActive !== undefined) {
    tag.isActive = Boolean(statusData.isActive);
  }
  if (statusData.isCustomerVisible !== undefined) {
    tag.isCustomerVisible = Boolean(statusData.isCustomerVisible);
  }

  await tag.save();
  return tag.populate('category', 'name slug icon image isActive');
};

/**
 * 6. Admin: Archive or Safe-Delete Tag
 * If existing bookings reference this tag, archive it (do not hard-delete) to maintain integrity.
 */
const archiveOrDeleteTag = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const err = new Error('Invalid tag ID');
    err.statusCode = 400;
    throw err;
  }

  const tag = await ServiceTag.findById(id);
  if (!tag) {
    const err = new Error('Service tag not found');
    err.statusCode = 404;
    throw err;
  }

  // Check if any bookings reference this tag
  const bookingCount = await Booking.countDocuments({ tag: tag._id });

  if (bookingCount > 0) {
    // Soft-archive to preserve audit and booking history
    tag.isArchived = true;
    tag.isActive = false;
    tag.isCustomerVisible = false;
    await tag.save();

    // Also deactivate this tag across provider profiles
    await Provider.updateMany(
      { 'serviceTags.tag': tag._id },
      { $set: { 'serviceTags.$[elem].isActive': false } },
      { arrayFilters: [{ 'elem.tag': tag._id }] }
    );

    return {
      action: 'archived',
      message: `Tag '${tag.name}' was archived because it is referenced in ${bookingCount} existing booking(s). Providers and customers will no longer see it.`
    };
  }

  // Check if providers have this tag selected
  const providerCount = await Provider.countDocuments({ 'serviceTags.tag': tag._id });
  if (providerCount > 0) {
    tag.isArchived = true;
    tag.isActive = false;
    tag.isCustomerVisible = false;
    await tag.save();

    await Provider.updateMany(
      { 'serviceTags.tag': tag._id },
      { $pull: { serviceTags: { tag: tag._id } } }
    );

    return {
      action: 'archived',
      message: `Tag '${tag.name}' was archived and unlinked from ${providerCount} provider profile(s).`
    };
  }

  // No bookings or providers reference it: safe hard delete
  await ServiceTag.findByIdAndDelete(tag._id);
  return {
    action: 'deleted',
    message: `Tag '${tag.name}' permanently deleted.`
  };
};

/**
 * 7. Admin: Get Providers Associated with Tag
 */
const getTagProviders = async (tagId, query = {}) => {
  if (!mongoose.Types.ObjectId.isValid(tagId)) {
    const err = new Error('Invalid tag ID');
    err.statusCode = 400;
    throw err;
  }

  const tag = await ServiceTag.findById(tagId).populate('category', 'name slug');
  if (!tag) {
    const err = new Error('Service tag not found');
    err.statusCode = 404;
    throw err;
  }

  const providers = await Provider.find({
    verificationStatus: 'verified',
    isDeleted: { $ne: true },
    'serviceTags.tag': tag._id
  })
    .populate('user', 'name phone email avatar isActive')
    .populate('categories', 'name slug')
    .lean();

  const formatted = providers.map((p) => {
    const item = p.serviceTags?.find((st) => String(st.tag) === String(tag._id));
    return {
      _id: p._id,
      businessName: p.businessName || p.user?.name || 'Provider',
      phone: p.user?.phone,
      email: p.user?.email,
      rating: p.rating,
      verificationStatus: p.verificationStatus,
      tagConfig: {
        approvalStatus: item?.approvalStatus || 'approved',
        isActive: item?.isActive !== false,
        basePrice: item?.basePrice || 0,
        pricingType: item?.pricingType || 'fixed',
        addedAt: item?.addedAt
      }
    };
  });

  return { tag, providers: formatted };
};

/**
 * 8. Public / Customer / Provider: Get all active, customer-visible tags for a category
 */
const getTagsForCategory = async (categoryId) => {
  let catId = categoryId;

  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    const cat = await Category.findOne({
      $or: [
        { slug: String(categoryId).toLowerCase() },
        { name: new RegExp(`^${escapeRegex(String(categoryId).trim())}$`, 'i') }
      ]
    });
    if (!cat) {
      return { category: null, tags: [], subcategories: [] };
    }
    catId = cat._id;
  }

  const category = await Category.findById(catId).select('name slug icon image isActive').lean();
  if (!category || category.isActive === false) {
    return { category: null, tags: [], subcategories: [] };
  }

  const tags = await ServiceTag.find({
    category: category._id,
    isActive: true,
    isCustomerVisible: true,
    isArchived: false
  })
    .sort({ displayOrder: 1, name: 1 })
    .lean();

  // Extract unique subcategories
  const subcategorySet = new Set();
  tags.forEach((t) => {
    if (t.subcategory?.name) {
      subcategorySet.add(t.subcategory.name);
    }
  });

  return {
    category,
    tags,
    subcategories: Array.from(subcategorySet)
  };
};

/**
 * 9. Provider Self-Management: Get Provider's Configured Tags + All Available Tags Catalog
 */
const getProviderServicesAndTags = async (userId) => {
  const provider = await Provider.findOne({ user: userId }).populate('categories', 'name slug');
  if (!provider) {
    const err = new Error('Provider profile not found');
    err.statusCode = 404;
    throw err;
  }

  // 1. Fetch all active, non-archived tags across the marketplace grouped by Category & Subcategory
  const allActiveTags = await ServiceTag.find({
    isActive: true,
    isArchived: false
  })
    .populate('category', 'name slug icon isActive')
    .sort({ 'category.name': 1, 'subcategory.name': 1, displayOrder: 1, name: 1 })
    .lean();

  // Filter out tags whose category is inactive
  const validTags = allActiveTags.filter((t) => t.category && t.category.isActive !== false);

  // Group tags by category
  const catalogByCategory = {};
  validTags.forEach((t) => {
    const catId = String(t.category._id);
    if (!catalogByCategory[catId]) {
      catalogByCategory[catId] = {
        category: t.category,
        subcategories: {}
      };
    }
    const subName = t.subcategory?.name || 'General';
    if (!catalogByCategory[catId].subcategories[subName]) {
      catalogByCategory[catId].subcategories[subName] = [];
    }
    catalogByCategory[catId].subcategories[subName].push(t);
  });

  // 2. Map provider's current selected tags
  const selectedTagMap = {};
  if (Array.isArray(provider.serviceTags)) {
    provider.serviceTags.forEach((st) => {
      selectedTagMap[String(st.tag)] = {
        tagId: String(st.tag),
        approvalStatus: st.approvalStatus || 'approved',
        isActive: st.isActive !== false,
        basePrice: st.basePrice || 0,
        pricingType: st.pricingType || 'fixed',
        experienceYears: st.experienceYears || 0,
        addedAt: st.addedAt,
        rejectionReason: st.rejectionReason
      };
    });
  }

  // 3. Legacy services created by provider (for backward compatibility)
  const legacyServices = await Service.find({ provider: provider._id }).lean();

  return {
    provider: {
      _id: provider._id,
      businessName: provider.businessName,
      categories: provider.categories,
      verificationStatus: provider.verificationStatus
    },
    selectedTags: Object.values(selectedTagMap),
    catalog: Object.values(catalogByCategory).map((item) => ({
      category: item.category,
      subcategories: Object.entries(item.subcategories).map(([name, tags]) => ({
        name,
        tags: tags.map((t) => ({
          ...t,
          isSelected: Boolean(selectedTagMap[String(t._id)]),
          selectedConfig: selectedTagMap[String(t._id)] || null
        }))
      }))
    })),
    legacyServices
  };
};

/**
 * 10. Provider: Save Selected Tags
 * Validates every tag against the active admin catalog.
 * Supports updating pricing, active state, and automatically syncs provider categories.
 */
const updateProviderTags = async (userId, payload) => {
  const provider = await Provider.findOne({ user: userId });
  if (!provider) {
    const err = new Error('Provider profile not found');
    err.statusCode = 404;
    throw err;
  }

  // Payload can be: { tagIds: [...] } OR { tags: [{ tagId, isActive, basePrice, pricingType }] }
  let inputTags = [];
  if (Array.isArray(payload)) {
    inputTags = payload;
  } else if (Array.isArray(payload.tags)) {
    inputTags = payload.tags;
  } else if (Array.isArray(payload.tagIds)) {
    inputTags = payload.tagIds.map((id) => ({ tagId: id }));
  } else {
    const err = new Error("Invalid payload: 'tags' or 'tagIds' array is required");
    err.statusCode = 400;
    throw err;
  }

  // Validate format and collect IDs
  const requestedTagIds = [];
  inputTags.forEach((item) => {
    const id = item.tagId || item._id || (typeof item === 'string' ? item : null);
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      const err = new Error(`Invalid service tag ID provided: '${id}'`);
      err.statusCode = 400;
      throw err;
    }
    requestedTagIds.push(new mongoose.Types.ObjectId(id));
  });

  // Verify against active admin catalog
  const catalogTags = await ServiceTag.find({
    _id: { $in: requestedTagIds },
    isActive: true,
    isArchived: false
  }).populate('category', 'isActive');

  if (catalogTags.length !== requestedTagIds.length) {
    const foundIds = new Set(catalogTags.map((t) => String(t._id)));
    const invalidIds = requestedTagIds.filter((id) => !foundIds.has(String(id)));
    const err = new Error(
      `One or more selected tags do not exist in the active catalog or have been archived: [${invalidIds.join(', ')}]`
    );
    err.statusCode = 400;
    throw err;
  }

  // Preserve existing approved status or audit data for already-selected tags
  const existingMap = {};
  if (Array.isArray(provider.serviceTags)) {
    provider.serviceTags.forEach((st) => {
      existingMap[String(st.tag)] = st;
    });
  }

  const updatedServiceTags = [];
  const associatedCategoryIds = new Set();

  catalogTags.forEach((tagDoc) => {
    const tagIdStr = String(tagDoc._id);
    const existing = existingMap[tagIdStr];
    const incomingConfig = inputTags.find(
      (item) => String(item.tagId || item._id || item) === tagIdStr
    );

    const isActive =
      incomingConfig?.isActive !== undefined
        ? Boolean(incomingConfig.isActive)
        : existing?.isActive !== undefined
        ? existing.isActive
        : true;

    const basePrice =
      incomingConfig?.basePrice !== undefined && !isNaN(Number(incomingConfig.basePrice))
        ? Math.max(0, Number(incomingConfig.basePrice))
        : existing?.basePrice || 0;

    const pricingType = incomingConfig?.pricingType || existing?.pricingType || 'fixed';

    updatedServiceTags.push({
      tag: tagDoc._id,
      approvalStatus: existing?.approvalStatus || 'approved',
      isActive,
      basePrice,
      pricingType,
      experienceYears: incomingConfig?.experienceYears || existing?.experienceYears || 0,
      addedAt: existing?.addedAt || new Date(),
      reviewedAt: existing?.reviewedAt || new Date(),
      rejectionReason: existing?.rejectionReason || null
    });

    if (tagDoc.category) {
      associatedCategoryIds.add(String(tagDoc.category._id || tagDoc.category));
    }
  });

  provider.serviceTags = updatedServiceTags;

  // Sync provider categories so category-level queries also match
  const existingCatIds = (provider.categories || []).map((c) => String(c));
  associatedCategoryIds.forEach((catId) => {
    if (!existingCatIds.includes(catId)) {
      provider.categories.push(new mongoose.Types.ObjectId(catId));
    }
  });

  await provider.save();

  return {
    success: true,
    message: `Successfully saved ${updatedServiceTags.length} service tag(s).`,
    serviceTags: provider.serviceTags
  };
};

/**
 * 11. Provider: Toggle single tag active state
 */
const toggleProviderTagStatus = async (userId, tagId, isActive) => {
  const provider = await Provider.findOne({ user: userId });
  if (!provider) {
    const err = new Error('Provider profile not found');
    err.statusCode = 404;
    throw err;
  }

  const tagIndex = (provider.serviceTags || []).findIndex(
    (st) => String(st.tag) === String(tagId)
  );

  if (tagIndex === -1) {
    const err = new Error('This service tag is not selected in your provider profile');
    err.statusCode = 404;
    throw err;
  }

  provider.serviceTags[tagIndex].isActive = Boolean(isActive);
  await provider.save();

  return {
    success: true,
    tagId,
    isActive: provider.serviceTags[tagIndex].isActive
  };
};

/**
 * 12. Customer Discovery: Get Verified Providers by Category and optional Tag
 * Matches verified, active providers offering the exact tag.
 */
const getProvidersByCategoryAndTag = async (categoryId, query = {}) => {
  const { tagId, page = 1, limit = 20, search } = query;

  // Resolve Category
  let categoryDoc = null;
  if (mongoose.Types.ObjectId.isValid(categoryId)) {
    categoryDoc = await Category.findById(categoryId).lean();
  } else {
    categoryDoc = await Category.findOne({
      $or: [
        { slug: String(categoryId).toLowerCase() },
        { name: new RegExp(`^${escapeRegex(String(categoryId).trim())}$`, 'i') }
      ]
    }).lean();
  }

  if (!categoryDoc || categoryDoc.isActive === false) {
    return {
      category: null,
      tag: null,
      providers: [],
      pagination: { total: 0, page: 1, limit: Number(limit), pages: 0 }
    };
  }

  // Base Verified Provider Filter
  const filter = {
    verificationStatus: 'verified',
    isAvailable: true,
    isDeleted: { $ne: true }
  };

  let tagDoc = null;

  // If specific Tag ID is requested
  if (tagId && String(tagId).trim() && String(tagId).trim() !== 'all') {
    const cleanTagId = String(tagId).trim();
    if (!mongoose.Types.ObjectId.isValid(cleanTagId)) {
      const err = new Error('Invalid service tag ID');
      err.statusCode = 400;
      throw err;
    }

    tagDoc = await ServiceTag.findOne({
      _id: cleanTagId,
      category: categoryDoc._id,
      isActive: true,
      isCustomerVisible: true,
      isArchived: false
    }).lean();

    if (!tagDoc) {
      // Tag does not belong to this category or is deactivated
      return {
        category: categoryDoc,
        tag: null,
        providers: [],
        pagination: { total: 0, page: 1, limit: Number(limit), pages: 0 }
      };
    }

    // Require provider to have this tag approved and active
    filter.serviceTags = {
      $elemMatch: {
        tag: tagDoc._id,
        isActive: true,
        approvalStatus: 'approved'
      }
    };
  } else {
    // When "All" is selected in category:
    // Match providers offering this category (via categories array OR having any active approved tag in this category)
    const categoryTagIds = await ServiceTag.find({
      category: categoryDoc._id,
      isActive: true,
      isCustomerVisible: true,
      isArchived: false
    }).distinct('_id');

    filter.$or = [
      { categories: categoryDoc._id },
      { 'serviceTags.tag': { $in: categoryTagIds } }
    ];
  }

  if (search && search.trim()) {
    const s = escapeRegex(search.trim());
    const searchCondition = {
      $or: [
        { businessName: new RegExp(s, 'i') },
        { bio: new RegExp(s, 'i') },
        { specialization: new RegExp(s, 'i') }
      ]
    };
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, searchCondition];
      delete filter.$or;
    } else {
      filter.$or = searchCondition.$or;
    }
  }

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const [providers, total] = await Promise.all([
    Provider.find(filter)
      .populate('user', 'name phone email avatar isActive')
      .populate('categories', 'name slug')
      .populate('serviceTags.tag', 'name slug category subcategory icon image')
      .sort({ 'rating.average': -1, completedBookingsCount: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Provider.countDocuments(filter)
  ]);

  // Enrich provider response with specific tag price and details
  const enrichedProviders = providers
    .filter((p) => p.user && p.user.isActive)
    .map((p) => {
      let matchedTagConfig = null;
      if (tagDoc) {
        matchedTagConfig = p.serviceTags?.find(
          (st) => String(st.tag?._id || st.tag) === String(tagDoc._id)
        );
      }

      return {
        _id: p._id,
        businessName: p.businessName || p.user?.name || 'Verified Provider',
        user: {
          _id: p.user?._id,
          name: p.user?.name,
          avatar: p.user?.avatar,
          phone: p.user?.phone
        },
        rating: p.rating || { average: 5.0, count: 0 },
        completedBookingsCount: p.completedBookingsCount || 0,
        experienceYears: p.experienceYears || 0,
        bio: p.bio || '',
        isAvailable: p.isAvailable,
        verificationStatus: p.verificationStatus,
        servicePrice: matchedTagConfig?.basePrice || p.pricing?.basePrice || 0,
        pricingType: matchedTagConfig?.pricingType || 'fixed',
        matchedTag: tagDoc
          ? {
              _id: tagDoc._id,
              name: tagDoc.name,
              subcategory: tagDoc.subcategory?.name
            }
          : null,
        activeTags: (p.serviceTags || [])
          .filter((st) => st.isActive && st.approvalStatus === 'approved' && st.tag)
          .map((st) => ({
            _id: st.tag?._id || st.tag,
            name: st.tag?.name,
            subcategory: st.tag?.subcategory?.name
          }))
      };
    });

  return {
    category: categoryDoc,
    tag: tagDoc,
    providers: enrichedProviders,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum)
    }
  };
};

module.exports = {
  listTags,
  getTagById,
  createTag,
  updateTag,
  updateTagStatus,
  archiveOrDeleteTag,
  getTagProviders,
  getTagsForCategory,
  getProviderServicesAndTags,
  updateProviderTags,
  toggleProviderTagStatus,
  getProvidersByCategoryAndTag
};

