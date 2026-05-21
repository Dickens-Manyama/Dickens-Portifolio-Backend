require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const apiRoutes = require("./routes");
const { corsOptions } = require("./services/cors");
const { fail } = require("./services/responses");
const { apiRateLimit } = require("./services/security");
const { requireHttps } = require("./services/https");
const path = require("path");

const app = express();

// Trust Render/Proxy headers (needed for correct IP/https detection).
app.set("trust proxy", 1);
app.disable("x-powered-by");

// Health checks must run before HTTPS enforcement (Render probes may omit x-forwarded-proto).
app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, status: "healthy" });
});

app.get("/", (req, res) => {
  res.status(200).json({ ok: true, service: "portfolio-backend" });
});

app.use(requireHttps);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(cors(corsOptions()));
app.use(express.json({ limit: "4mb" }));
app.use(apiRateLimit);
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Serve public files (uploads, static assets)
app.use("/public", express.static(path.join(__dirname, "public")));

app.use("/api", apiRoutes);

// 404 handler
app.use((req, res) => {
  return fail(res, 404, "Route not found.");
});

// Central error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const message = err?.message || "Server error";
  // CORS errors often arrive here
  const status = message.startsWith("CORS blocked") ? 403 : 500;
  return fail(res, status, message);
});

const port = Number(process.env.PORT || 5000);
const host = process.env.HOST || "0.0.0.0";
app.listen(port, host, () => {
  console.log(`[backend] listening on ${host}:${port}`);
});

