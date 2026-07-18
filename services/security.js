const { createRateLimit } = require("./rateLimit");

const apiRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  // The public site polls 4 endpoints every 20s per open tab, so a low
  // ceiling starves the frontend of data after a few minutes of browsing.
  max: 2000,
  message: "Too many API requests. Please slow down.",
});

const loginRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many login attempts. Please wait and try again.",
});

const contactRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: "Too many contact submissions. Please wait and try again.",
});

module.exports = { apiRateLimit, loginRateLimit, contactRateLimit };
