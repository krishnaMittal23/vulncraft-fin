const express = require("express");
const session = require("express-session");
const passport = require("passport");
const mongoose = require("mongoose");
const morgan = require("morgan");
const cors = require("cors");
require("dotenv").config();
require("./config/passport");

const authRoutes = require("./routes/authRoute");
const githubRoutes = require("./routes/githubRoute");
const codeRoutes = require("./routes/codeRoute");
const flowchartRoutes = require("./routes/flowChartRoute");
const chatRoutes = require("./routes/chatRoute");
const workflowRoutes = require("./routes/workflowRoute");
const reportRoutes = require("./routes/reportRoute");
const { FRONTEND_URL } = require("./lib/constant");

const app = express();

// Database Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("MongoDB Connection Error:", err));

// Middleware
app.use(cors({ origin: `${FRONTEND_URL}`, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());

// Logging
app.use(morgan("dev"));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/github", githubRoutes);
app.use("/api/code", codeRoutes);
app.use('/api/flowchart', flowchartRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/reports', reportRoutes);

module.exports = app;