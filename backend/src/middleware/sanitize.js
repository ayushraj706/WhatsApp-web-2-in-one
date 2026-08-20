const sanitizeHtml = require("sanitize-html");

/**
 * Strips HTML/script injection from every string field in req.body.
 * Prevents stored-XSS in chat messages and AI prompts.
 */
function deepSanitize(obj) {
  if (typeof obj === "string") {
    return sanitizeHtml(obj, { allowedTags: [], allowedAttributes: {} });
  }
  if (Array.isArray(obj)) return obj.map(deepSanitize);
  if (obj && typeof obj === "object") {
    const out = {};
    for (const key of Object.keys(obj)) out[key] = deepSanitize(obj[key]);
    return out;
  }
  return obj;
}

function sanitizeBody(req, res, next) {
  if (req.body) req.body = deepSanitize(req.body);
  next();
}

module.exports = { sanitizeBody, deepSanitize };
