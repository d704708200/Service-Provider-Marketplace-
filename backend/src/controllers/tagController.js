const tagService = require('../services/tagService');

/**
 * GET /api/tags
 * Query tags with optional filters
 */
const getTags = async (req, res, next) => {
  try {
    const result = await tagService.listTags(req.query);
    res.status(200).json({
      success: true,
      message: 'Service tags retrieved successfully',
      data: result.tags,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tags/:id
 */
const getTagById = async (req, res, next) => {
  try {
    const tag = await tagService.getTagById(req.params.id);
    res.status(200).json({
      success: true,
      data: tag
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/tags
 * Admin creates tag
 */
const createTag = async (req, res, next) => {
  try {
    const tag = await tagService.createTag(req.body);
    res.status(201).json({
      success: true,
      message: 'Service tag created successfully',
      data: tag
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/tags/:id
 * Admin updates tag
 */
const updateTag = async (req, res, next) => {
  try {
    const tag = await tagService.updateTag(req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Service tag updated successfully',
      data: tag
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/tags/:id/status
 * Admin toggles tag active / customer visible status
 */
const updateTagStatus = async (req, res, next) => {
  try {
    const tag = await tagService.updateTagStatus(req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Service tag status updated successfully',
      data: tag
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/tags/:id
 * Admin safe-delete or archive tag
 */
const deleteTag = async (req, res, next) => {
  try {
    const result = await tagService.archiveOrDeleteTag(req.params.id);
    res.status(200).json({
      success: true,
      action: result.action,
      message: result.message
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/tags/:id/providers
 * Admin view providers associated with tag
 */
const getTagProviders = async (req, res, next) => {
  try {
    const result = await tagService.getTagProviders(req.params.id, req.query);
    res.status(200).json({
      success: true,
      data: result.providers,
      tag: result.tag
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/categories/:categoryId/tags
 * Public / customer discovery tags for category
 */
const getCategoryTags = async (req, res, next) => {
  try {
    const result = await tagService.getTagsForCategory(req.params.categoryId);
    res.status(200).json({
      success: true,
      data: result.tags,
      category: result.category,
      subcategories: result.subcategories
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/provider/my-services
 * Provider self-management: view catalog and selected tags
 */
const getProviderServicesAndTags = async (req, res, next) => {
  try {
    const result = await tagService.getProviderServicesAndTags(req.user._id);
    res.status(200).json({
      success: true,
      message: 'Provider services and tag catalog retrieved',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/provider/my-services/tags
 * Provider saves selected service tags
 */
const updateProviderTags = async (req, res, next) => {
  try {
    const result = await tagService.updateProviderTags(req.user._id, req.body);
    res.status(200).json({
      success: true,
      message: result.message,
      data: result.serviceTags
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/provider/my-services/tags/:tagId/status
 * Provider toggles individual tag active status
 */
const toggleProviderTagStatus = async (req, res, next) => {
  try {
    const result = await tagService.toggleProviderTagStatus(
      req.user._id,
      req.params.tagId,
      req.body.isActive
    );
    res.status(200).json({
      success: true,
      message: `Service tag ${result.isActive ? 'activated' : 'deactivated'} successfully`,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/providers/by-category/:categoryId
 * Customer discovery: providers filtered by category and optional tagId
 */
const getProvidersByCategory = async (req, res, next) => {
  try {
    const result = await tagService.getProvidersByCategoryAndTag(
      req.params.categoryId,
      req.query
    );
    res.status(200).json({
      success: true,
      data: result.providers,
      category: result.category,
      tag: result.tag,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTags,
  getTagById,
  createTag,
  updateTag,
  updateTagStatus,
  deleteTag,
  getTagProviders,
  getCategoryTags,
  getProviderServicesAndTags,
  updateProviderTags,
  toggleProviderTagStatus,
  getProvidersByCategory
};

