const categoryService = require('../services/categoryService');

/**
 * GET /api/categories
 * List active categories for public customer/provider use
 */
const getPublicCategories = async (req, res, next) => {
  try {
    const categories = await categoryService.getPublicCategories(req.query);
    res.status(200).json({
      success: true,
      message: 'Active categories retrieved successfully',
      data: categories
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/categories/admin
 * Admin-only category listing including inactive, with service counts and pagination
 */
const getAdminCategories = async (req, res, next) => {
  try {
    const result = await categoryService.getAdminCategories(req.query);
    res.status(200).json({
      success: true,
      message: 'Admin categories retrieved successfully',
      data: result.categories,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/categories/:id
 * Retrieve details for a single category
 */
const getCategoryById = async (req, res, next) => {
  try {
    const category = await categoryService.getCategoryById(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Category retrieved successfully',
      data: category
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/categories
 * Admin-only: create new category
 */
const createCategory = async (req, res, next) => {
  try {
    const category = await categoryService.createCategory(req.body);
    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/categories/:id
 * Admin-only: update category details
 */
const updateCategory = async (req, res, next) => {
  try {
    const category = await categoryService.updateCategory(req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      data: category
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/categories/:id/status
 * Admin-only: activate or deactivate category
 */
const updateCategoryStatus = async (req, res, next) => {
  try {
    const category = await categoryService.updateCategoryStatus(req.params.id, req.body.isActive);
    res.status(200).json({
      success: true,
      message: `Category ${category.isActive ? 'activated' : 'deactivated'} successfully`,
      data: category
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/categories/:id
 * Admin-only: safe deletion or deactivation
 */
const deleteCategory = async (req, res, next) => {
  try {
    const result = await categoryService.deleteCategory(req.params.id);
    res.status(200).json({
      success: true,
      message: `Category '${result.name}' deleted successfully`,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPublicCategories,
  getAdminCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  updateCategoryStatus,
  deleteCategory
};
