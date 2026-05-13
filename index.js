require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const apiRoutes = require("./routes");
const { corsOptions } = require("./services/cors");
const { fail } = require("./services/responses");

const app = express();

// Trust Render/Proxy headers (needed for correct IP/https detection).
app.set("trust proxy", 1);

app.use(helmet());
app.use(cors(corsOptions()));
app.use(express.json({ limit: "250kb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, status: "healthy" });
});

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
app.listen(port, () => {
  console.log(`[backend] listening on port ${port}`);
});

