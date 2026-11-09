/**
 * Geospatial Utilities for Service Radius & Location Validation
 */

const EARTH_RADIUS_KM = 6371;

/**
 * Calculate the great-circle distance between two points on the Earth's surface
 * using the Haversine formula.
 * @param {number} lat1 Latitude of point 1 in degrees
 * @param {number} lon1 Longitude of point 1 in degrees
 * @param {number} lat2 Latitude of point 2 in degrees
 * @param {number} lon2 Longitude of point 2 in degrees
 * @returns {number} Distance in kilometres (rounded to 2 decimal places)
 */
const calculateHaversineDistanceKm = (lat1, lon1, lat2, lon2) => {
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);

  if (
    isNaN(nLat1) ||
    isNaN(nLon1) ||
    isNaN(nLat2) ||
    isNaN(nLon2)
  ) {
    throw new Error('Invalid coordinates supplied for Haversine distance calculation');
  }

  // Exact same point check
  if (nLat1 === nLat2 && nLon1 === nLon2) {
    return 0;
  }

  const toRad = (degree) => (degree * Math.PI) / 180;
  const dLat = toRad(nLat2 - nLat1);
  const dLon = toRad(nLon2 - nLon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(nLat1)) *
      Math.cos(toRad(nLat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = EARTH_RADIUS_KM * c;

  return Math.round(distance * 100) / 100;
};

/**
 * Validate latitude value (-90 to +90 degrees)
 * Rejects 0 when allowZero is false (to prevent default empty dummy coordinate bugs)
 */
const isValidLatitude = (lat, allowZero = false) => {
  if (lat === null || lat === undefined || lat === '') return false;
  const n = Number(lat);
  if (isNaN(n)) return false;
  if (!allowZero && n === 0) return false;
  return n >= -90 && n <= 90;
};

/**
 * Validate longitude value (-180 to +180 degrees)
 * Rejects 0 when allowZero is false
 */
const isValidLongitude = (lon, allowZero = false) => {
  if (lon === null || lon === undefined || lon === '') return false;
  const n = Number(lon);
  if (isNaN(n)) return false;
  if (!allowZero && n === 0) return false;
  return n >= -180 && n <= 180;
};

/**
 * Validate a GeoJSON coordinate pair [longitude, latitude]
 * GeoJSON convention is [lng, lat]
 */
const isValidGeoJsonCoordinates = (coordinates, allowZero = false) => {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) return false;
  const [lng, lat] = coordinates;
  return isValidLongitude(lng, allowZero) && isValidLatitude(lat, allowZero);
};

module.exports = {
  EARTH_RADIUS_KM,
  calculateHaversineDistanceKm,
  isValidLatitude,
  isValidLongitude,
  isValidGeoJsonCoordinates
};

