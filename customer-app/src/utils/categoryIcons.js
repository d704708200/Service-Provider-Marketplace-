/**
 * Centralized Category Icon Mapping & Validator
 *
 * Ensures all category and service icons passed to Ionicons are guaranteed valid icon names.
 * Protects against long descriptions, invalid strings, or missing icons from the database.
 */

// Strict pattern for valid Ionicons name: lowercase alphanumeric with hyphens, 2 to 35 chars
const IONICON_NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/i;

/**
 * Standard category-to-Ionicons mapping
 */
export const CATEGORY_ICON_MAP = {
  electrician: 'flash-outline',
  electrical: 'flash-outline',
  'ac service': 'snow-outline',
  'ac-service': 'snow-outline',
  'ac repair': 'snow-outline',
  mechanic: 'construct-outline',
  plumber: 'water-outline',
  plumbing: 'water-outline',
  'bike car mechanic': 'car-outline',
  'bike-car-mechanic': 'car-outline',
  bike: 'bicycle-outline',
  car: 'car-outline',
  'ro / water purifier repair': 'water-outline',
  'ro-water-purifier-repair': 'water-outline',
  'ro / water purifier': 'water-outline',
  'ro water purifier': 'water-outline',
  'water purifier': 'water-outline',
  'washing machine repair': 'sync-outline',
  'washing-machine-repair': 'sync-outline',
  'washing machine': 'sync-outline',
  "women’s beauty services": 'sparkles-outline',
  "women's beauty services": 'sparkles-outline',
  'womens beauty services': 'sparkles-outline',
  'womens-beauty-services': 'sparkles-outline',
  beauty: 'sparkles-outline',
  salon: 'sparkles-outline',
  carpenter: 'hammer-outline',
  carpentry: 'hammer-outline',
  woodwork: 'hammer-outline',
  painter: 'color-palette-outline',
  painting: 'color-palette-outline',
  cleaner: 'sparkles-outline',
  cleaning: 'sparkles-outline',
  'pest control': 'shield-outline',
  pest: 'shield-outline'
};

export const DEFAULT_CATEGORY_ICON = 'grid-outline';

/**
 * Safely resolves and validates an icon name for the Ionicons icon family.
 *
 * @param {string} rawIcon - Icon identifier from backend/database
 * @param {string} categoryName - Category or service display name
 * @returns {string} Guaranteed valid Ionicons icon identifier
 */
export function getValidCategoryIcon(rawIcon, categoryName) {
  // 1. If rawIcon is already a valid, concise Ionicons name (no spaces, <= 35 chars)
  if (
    rawIcon &&
    typeof rawIcon === 'string' &&
    rawIcon.trim().length >= 2 &&
    rawIcon.trim().length <= 35 &&
    IONICON_NAME_REGEX.test(rawIcon.trim())
  ) {
    return rawIcon.trim().toLowerCase();
  }

  // 2. Lookup by exact normalized categoryName
  const normalizedName = (categoryName || '').toLowerCase().trim();
  if (CATEGORY_ICON_MAP[normalizedName]) {
    return CATEGORY_ICON_MAP[normalizedName];
  }

  // 3. Match against category keywords
  for (const [key, icon] of Object.entries(CATEGORY_ICON_MAP)) {
    if (normalizedName.includes(key)) {
      return icon;
    }
  }

  // 4. Safe default icon when no mapping matches
  return DEFAULT_CATEGORY_ICON;
}

export default {
  CATEGORY_ICON_MAP,
  DEFAULT_CATEGORY_ICON,
  getValidCategoryIcon
};

