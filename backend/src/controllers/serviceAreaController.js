const serviceAreaService = require('../services/serviceAreaService');

const getAdminServiceAreas = async (req, res, next) => {
  try {
    const result = await serviceAreaService.getAdminServiceAreas(req.query);
    res.status(200).json({
      success: true,
      message: 'Service areas retrieved successfully',
      data: result.areas,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

const createServiceArea = async (req, res, next) => {
  try {
    const area = await serviceAreaService.createServiceAreaByAdmin(req.body);
    res.status(201).json({
      success: true,
      message: 'Service area created successfully',
      data: area
    });
  } catch (error) {
    next(error);
  }
};

const updateServiceArea = async (req, res, next) => {
  try {
    const area = await serviceAreaService.updateServiceAreaByAdmin(req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Service area updated successfully',
      data: area
    });
  } catch (error) {
    next(error);
  }
};

const toggleServiceAreaStatus = async (req, res, next) => {
  try {
    const { isActive } = req.body;
    const area = await serviceAreaService.toggleServiceAreaStatusByAdmin(req.params.id, isActive);
    res.status(200).json({
      success: true,
      message: `Service area ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: area
    });
  } catch (error) {
    next(error);
  }
};

const deleteServiceArea = async (req, res, next) => {
  try {
    const result = await serviceAreaService.deleteServiceAreaByAdmin(req.params.id);
    res.status(200).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Public search for manual address entry autocomplete
 */
const searchAddress = async (req, res, next) => {
  try {
    const q = req.query.q || req.query.query;
    if (!q || !q.trim()) {
      return res.status(200).json({ success: true, data: [] });
    }

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      q.trim()
    )}&addressdetails=1&limit=8`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ServiceProviderMarketplace/1.0 (contact@service-marketplace.internal)'
      }
    });

    if (!response.ok) {
      throw new Error(`Geocoding search service responded with status ${response.status}`);
    }

    const items = await response.json();
    const suggestions = items.map((item) => {
      const addr = item.address || {};
      const city =
        addr.city ||
        addr.town ||
        addr.village ||
        addr.suburb ||
        addr.state_district ||
        addr.county ||
        '';
      const locality = addr.suburb || addr.neighbourhood || addr.residential || addr.road || '';
      const street = [addr.house_number, addr.road].filter(Boolean).join(' ') || locality;
      const state = addr.state || '';
      const zipCode = addr.postcode || '';

      return {
        formattedAddress: item.display_name,
        street,
        locality,
        city,
        state,
        zipCode,
        latitude: Number(item.lat),
        longitude: Number(item.lon)
      };
    });

    res.status(200).json({
      success: true,
      data: suggestions
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Public reverse geocoding from coordinates
 */
const reverseGeocode = async (req, res, next) => {
  try {
    const lat = req.query.lat || req.query.latitude;
    const lon = req.query.lon || req.query.lng || req.query.longitude;

    if (!lat || !lon) {
      const err = new Error('Latitude and longitude parameters are required');
      err.statusCode = 400;
      throw err;
    }

    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(
      lat
    )}&lon=${encodeURIComponent(lon)}&addressdetails=1`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ServiceProviderMarketplace/1.0 (contact@service-marketplace.internal)'
      }
    });

    if (!response.ok) {
      throw new Error(`Reverse geocoding service responded with status ${response.status}`);
    }

    const item = await response.json();
    const addr = item.address || {};
    const city =
      addr.city ||
      addr.town ||
      addr.village ||
      addr.suburb ||
      addr.state_district ||
      addr.county ||
      '';
    const locality = addr.suburb || addr.neighbourhood || addr.residential || addr.road || '';
    const street = [addr.house_number, addr.road].filter(Boolean).join(' ') || locality;
    const state = addr.state || '';
    const zipCode = addr.postcode || '';

    res.status(200).json({
      success: true,
      data: {
        formattedAddress: item.display_name,
        street,
        locality,
        city,
        state,
        zipCode,
        latitude: Number(item.lat),
        longitude: Number(item.lon)
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAdminServiceAreas,
  createServiceArea,
  updateServiceArea,
  toggleServiceAreaStatus,
  deleteServiceArea,
  searchAddress,
  reverseGeocode
};
