const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { createTables } = require("./config/database");
const authRoutes = require("./routes/authRoutes");
const pinRoutes = require("./routes/pinRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: "*", // Allow all origins for development
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/pin", pinRoutes);

// Health check route
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Plutiply API is running",
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Something went wrong!",
  });
});

// Initialize database and start server
const startServer = async () => {
  try {
    await createTables();
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📡 API endpoint: http://localhost:${PORT}/api`);
      console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
