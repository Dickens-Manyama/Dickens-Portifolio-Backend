function requireHttps(req, res, next) {
  if (process.env.NODE_ENV === "production") {
    const proto = req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http");
    if (String(proto).toLowerCase() !== "https") {
      return res.status(403).json({ message: "HTTPS is required." });
    }
  }

  return next();
}

module.exports = { requireHttps };
