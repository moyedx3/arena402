import express from "express";
import { env, isDevelopment } from "./config.js";
import arenaRoutes from "./routes/arena.js";

const app = express();

// Middleware
app.use(express.json());

// Request logging in development
if (isDevelopment) {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "0.1.0",
  });
});

// Are.na proxy routes
app.use("/v2", arenaRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Not found",
    message: `Cannot ${req.method} ${req.path}`,
  });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: isDevelopment ? err.message : "An unexpected error occurred",
  });
});

// Start server
app.listen(env.port, () => {
  console.log(`
  🚀 Arena402 API Server

  Environment: ${env.nodeEnv}
  Port: ${env.port}

  Endpoints:
    GET /health                    - Health check
    GET /v2/channels/:slug         - Get channel info
    GET /v2/channels/:slug/contents - Get channel contents
    GET /v2/blocks/:id             - Get block content
  `);
});
