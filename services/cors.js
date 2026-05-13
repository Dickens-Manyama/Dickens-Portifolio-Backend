function normalizeOrigin(origin) {
  if (!origin) return null;
  try {
    return new URL(origin).origin;
  } catch {
    return null;
  }
}

function buildAllowedOrigins() {
  const allowed = new Set();

  // Production frontend
  if (process.env.CLIENT_URL) allowed.add(process.env.CLIENT_URL);

  // Local dev frontends
  allowed.add("http://localhost:3000");
  allowed.add("http://127.0.0.1:3000");
  allowed.add("http://localhost:3001");
  allowed.add("http://127.0.0.1:3001");
  allowed.add("http://localhost:5173");
  allowed.add("http://127.0.0.1:5173");

  // Normalize to origins.
  return new Set([...allowed].map(normalizeOrigin).filter(Boolean));
}

function corsOptions() {
  const allowedOrigins = buildAllowedOrigins();

  return {
    origin(origin, callback) {
      // Allow non-browser requests (like curl/postman/render health checks)
      if (!origin) return callback(null, true);

      const normalized = normalizeOrigin(origin);
      if (normalized && allowedOrigins.has(normalized)) return callback(null, true);

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: false,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    maxAge: 86400,
  };
}

module.exports = { corsOptions };

