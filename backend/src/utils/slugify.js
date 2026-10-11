const slugify = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphen
    .replace(/[^\w-]+/g, '') // Remove all non-word chars except hyphen
    .replace(/--+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+/, '') // Trim hyphens from start
    .replace(/-+$/, ''); // Trim hyphens from end
};

module.exports = {
  slugify
};
