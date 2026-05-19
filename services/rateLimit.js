function createRateLimit({ windowMs, max, message }) {
  const hits = new Map();

  return function rateLimit(req, res, next) {
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    const now = Date.now();
    const entry = hits.get(ip);

    if (!entry || now >= entry.resetAt) {
      hits.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({ message: message || "Too many requests. Please try again later." });
    }

    entry.count += 1;
    hits.set(ip, entry);
    return next();
  };
}

module.exports = { createRateLimit };
