function normalizeOrigin(origin) {
  if (!origin) return null;

  try {
    return new URL(origin).origin;
  } catch {
    return null;
  }
}

function buildAllowedOrigins() {
  const allowed = new Set([
    // Production domains
    "https://dickens-manyama.tech",
    "https://www.dickens-manyama.tech",
    "https://dickens-portifolio.vercel.app",

    // Local development
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]);

  // Optional: add more origins from Render env variable
  if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS
      .split(",")
      .map(origin => origin.trim())
      .filter(Boolean)
      .forEach(origin => allowed.add(origin));
  }

  return new Set(
    [...allowed]
      .map(normalizeOrigin)
      .filter(Boolean)
  );
}

function corsOptions() {
  const allowedOrigins = buildAllowedOrigins();

  return {
    origin(origin, callback) {
      console.log("Incoming Origin:", origin);

      // Allow server-to-server requests, Postman, curl, Render health checks
      if (!origin) {
        return callback(null, true);
      }

      const normalized = normalizeOrigin(origin);

      if (
        normalized &&
        allowedOrigins.has(normalized)
      ) {
        return callback(null, true);
      }

      console.error(`CORS blocked for origin: ${origin}`);

      return callback(
        new Error(`CORS blocked for origin: ${origin}`)
      );
    },

    credentials: false,

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
    ],

    maxAge: 86400,
  };
}

module.exports = { corsOptions };
