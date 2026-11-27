// Shared server-side input validation & regex sanitization helpers

const escapeRegex = (str = '') =>
  String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parsePositiveIntQty = (val, { min = 1, max = 10000, allowEmpty = false, defaultVal = 1 } = {}) => {
  if (val === undefined || val === null || val === '') {
    return allowEmpty ? defaultVal : null;
  }
  const num = Number(val);
  if (!Number.isFinite(num) || !Number.isInteger(num) || num < min || num > max) {
    return null;
  }
  return num;
};

const parseNonNegativePrice = (val, { allowEmpty = false, defaultVal = 0, max = 1000000000 } = {}) => {
  if (val === undefined || val === null || val === '') {
    return allowEmpty ? defaultVal : null;
  }
  const num = Number(val);
  if (!Number.isFinite(num) || num < 0 || num > max) {
    return null;
  }
  return num;
};

module.exports = {
  escapeRegex,
  parsePositiveIntQty,
  parseNonNegativePrice,
};
