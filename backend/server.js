const app = require("./src/app");
const http = require("http");
const { Server } = require("socket.io");
const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  },
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log(`📡 Client connected: ${socket.id}`);

  socket.on("join-workflow", (workflowId) => {
    socket.join(`workflow-${workflowId}`);
    console.log(`📡 Socket ${socket.id} joined workflow-${workflowId}`);
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

// TODO: Add Logger
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = { io, server };