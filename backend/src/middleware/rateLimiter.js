const rateLimit = require("express-rate-limit");

// General API protection
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120, // 120 req/min/IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, slow down." },
});

// Stricter limiter for AI endpoints (cost-sensitive + abuse-prone)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: "AI request limit exceeded. Try again shortly." },
});

module.exports = { apiLimiter, aiLimiter };
