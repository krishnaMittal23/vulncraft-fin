const app = require("./src/app");
const http = require("http");
const { Server } = require("socket.io");
const { verifyToken } = require("./src/lib/token");
const Workflow = require("./src/models/Workflow");
const { redisEnabled, createRedis } = require("./src/lib/redis");
const { startReaper } = require("./src/lib/reaper");
const { startWorkflowWorker } = require("./src/lib/workflowQueue");
const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  },
});

// Multi-instance live events: fan out Socket.IO across instances via Redis.
if (redisEnabled()) {
  const { createAdapter } = require("@socket.io/redis-adapter");
  const pub = createRedis();
  const sub = createRedis();
  io.adapter(createAdapter(pub, sub));
  console.log("[socket.io] using Redis adapter");
}

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Unauthorized"));
    const decoded = verifyToken(token);
    socket.userId = decoded.id;
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log(`📡 Client connected: ${socket.id}`);

  socket.on("join-workflow", async (workflowId) => {
    try {
      const wf = await Workflow.findById(workflowId).select("userId");
      if (!wf || wf.userId.toString() !== socket.userId) {
        console.warn(`📡 Socket ${socket.id} denied join for workflow ${workflowId}`);
        return;
      }
      socket.join(`workflow-${workflowId}`);
      console.log(`📡 Socket ${socket.id} joined workflow-${workflowId}`);
    } catch (err) {
      console.error("join-workflow error:", err.message);
    }
  });

  socket.on("leave-workflow", (workflowId) => {
    socket.leave(`workflow-${workflowId}`);
    console.log(`📡 Socket ${socket.id} left workflow-${workflowId}`);
  });

  socket.on("disconnect", () => {
    console.log(`📡 Client disconnected: ${socket.id}`);
  });
});

// Make io available to other modules
app.set('io', io);

// Auto-close stale "running" reports, and (if Redis) consume queued workflow jobs.
startReaper();
startWorkflowWorker(io);

// TODO: Add Logger
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = { io, server };