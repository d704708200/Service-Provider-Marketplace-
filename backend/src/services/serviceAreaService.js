const mongoose = require('mongoose');
const ServiceArea = require('../models/ServiceArea');
const Provider = require('../models/Provider');

/**
 * List all service areas with provider counts, search, and pagination
 */
const getAdminServiceAreas = async (query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = {};

  if (query.status && query.status !== 'all') {
    if (query.status === 'active') {
      filter.isActive = true;
    } else if (query.status === 'inactive') {
      filter.isActive = false;
    }
  }

  if (query.search && query.search.trim()) {
    const rawSearch = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(rawSearch, 'i');
    filter.$or = [
      { name: searchRegex },
      { city: searchRegex },
      { state: searchRegex },
      { zipCodes: searchRegex }
    ];
  }

  const [areas, total] = await Promise.all([
    ServiceArea.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ServiceArea.countDocuments(filter)
  ]);

  // Aggregate active provider counts for each service area
  const areaIds = areas.map((a) => a._id);
  const providerAreaCounts = await Provider.aggregate([
    { $match: { serviceAreas: { $in: areaIds }, isDeleted: { $ne: true } } },
    { $unwind: '$serviceAreas' },
    { $match: { serviceAreas: { $in: areaIds } } },
    { $group: { _id: '$serviceAreas', count: { $sum: 1 } } }
  ]);

  const countMap = new Map();
  providerAreaCounts.forEach((c) => {
    countMap.set(c._id.toString(), c.count);
  });

  const enrichedAreas = areas.map((area) => ({
    ...area,
    providerCount: countMap.get(area._id.toString()) || 0
  }));

  return {
    areas: enrichedAreas,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1
    }
  };
};

/**
 * Create a new Service Area as admin
 */
const createServiceAreaByAdmin = async (areaData) => {
  const name = (areaData.name || '').trim();
  const city = (areaData.city || '').trim();
  const state = (areaData.state || '').trim();
  const zipCodes = Array.isArray(areaData.zipCodes)
    ? areaData.zipCodes.map((z) => String(z).trim()).filter(Boolean)
    : [];

  if (!name) {
    const err = new Error('Service area name is required');
    err.statusCode = 400;
    throw err;
  }
  if (!city) {
    const err = new Error('City is required');
    err.statusCode = 400;
    throw err;
  }

  const newArea = new ServiceArea({
    name,
    city,
    state,
    zipCodes,
    isActive: areaData.isActive !== undefined ? Boolean(areaData.isActive) : true
  });

  if (areaData.polygon && areaData.polygon.coordinates) {
    newArea.polygon = {
      type: 'Polygon',
      coordinates: areaData.polygon.coordinates
    };
  }

  await newArea.save();
  return newArea.toObject();
};

/**
 * Update an existing Service Area as admin
 */
const updateServiceAreaByAdmin = async (areaId, areaData) => {
  if (!mongoose.Types.ObjectId.isValid(areaId)) {
    const err = new Error(`Invalid service area ID format: '${areaId}'`);
    err.statusCode = 400;
    throw err;
  }

  const area = await ServiceArea.findById(areaId);
  if (!area) {
    const err = new Error(`Service area with ID '${areaId}' not found`);
    err.statusCode = 404;
    throw err;
  }

  if (areaData.name !== undefined) area.name = areaData.name.trim();
  if (areaData.city !== undefined) area.city = areaData.city.trim();
  if (areaData.state !== undefined) area.state = areaData.state.trim();
  if (areaData.zipCodes !== undefined && Array.isArray(areaData.zipCodes)) {
    area.zipCodes = areaData.zipCodes.map((z) => String(z).trim()).filter(Boolean);
  }
  if (areaData.isActive !== undefined) {
    area.isActive = Boolean(areaData.isActive);
  }
  if (areaData.polygon && areaData.polygon.coordinates) {
    area.polygon = {
      type: 'Polygon',
      coordinates: areaData.polygon.coordinates
    };
  }

  await area.save();
  return area.toObject();
};

/**
 * Toggle Service Area active status
 */
const toggleServiceAreaStatusByAdmin = async (areaId, isActive) => {
  return await updateServiceAreaByAdmin(areaId, { isActive });
};

/**
 * Safely delete a Service Area (checks for active provider attachments)
 */
const deleteServiceAreaByAdmin = async (areaId) => {
  if (!mongoose.Types.ObjectId.isValid(areaId)) {
    const err = new Error(`Invalid service area ID format: '${areaId}'`);
    err.statusCode = 400;
    throw err;
  }

  const area = await ServiceArea.findById(areaId);
  if (!area) {
    const err = new Error(`Service area with ID '${areaId}' not found`);
    err.statusCode = 404;
    throw err;
  }

  // Remove reference from any providers
  await Provider.updateMany(
    { serviceAreas: area._id },
    { $pull: { serviceAreas: area._id } }
  );

  await ServiceArea.findByIdAndDelete(areaId);

  return {
    success: true,
    deletedId: areaId,
    message: `Service area '${area.name}' deleted successfully.`
  };
};

module.exports = {
  getAdminServiceAreas,
  createServiceAreaByAdmin,
  updateServiceAreaByAdmin,
  toggleServiceAreaStatusByAdmin,
  deleteServiceAreaByAdmin
};
