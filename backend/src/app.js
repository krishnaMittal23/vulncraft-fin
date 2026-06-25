const express = require("express");
const mongoose = require("mongoose");
const morgan = require("morgan");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const { redisEnabled, getRedis } = require("./lib/redis");
require("dotenv").config();

// Shared Redis store for rate limiting when available (otherwise per-instance
// memory store). Keeps limits consistent across restarts / multiple instances.
const rlStore = (prefix) => {
  if (!redisEnabled()) return undefined;
  const client = getRedis();
  return new RedisStore({ sendCommand: (...args) => client.call(...args), prefix });
};

const authRoutes = require("./routes/authRoute");
const githubRoutes = require("./routes/githubRoute");
const codeRoutes = require("./routes/codeRoute");
const flowchartRoutes = require("./routes/flowChartRoute");
const chatRoutes = require("./routes/chatRoute");
const workflowRoutes = require("./routes/workflowRoute");
const reportRoutes = require("./routes/reportRoute");
const settingsRoutes = require("./routes/settingsRoute");
const { FRONTEND_URL } = require("./lib/constant");

const app = express();

app.use(helmet());
app.use(cookieParser());

// Database Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("MongoDB Connection Error:", err));

// Middleware
app.use(cors({ origin: `${FRONTEND_URL}`, credentials: true }));
app.use(express.json({ limit: process.env.MAX_BODY_SIZE || '10mb' }));
app.use(express.urlencoded({ limit: process.env.MAX_BODY_SIZE || '10mb', extended: true }));

// Logging
app.use(morgan("dev"));

// Rate limiters. LLM + scan routes are expensive, so cap them tighter.
const llmLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please slow down." },
  store: rlStore("rl:llm:"),
});
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  store: rlStore("rl:api:"),
});

app.use("/api", apiLimiter);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/github", githubRoutes);
app.use("/api/code", llmLimiter, codeRoutes);
app.use('/api/flowchart', llmLimiter, flowchartRoutes);
app.use('/api/chat', llmLimiter, chatRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);

module.exports = app;
