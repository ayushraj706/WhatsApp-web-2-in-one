const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

function initSocketServer(server) {
  const io = new Server(server, {
    cors: { origin: process.env.FRONTEND_URL, credentials: true },
  });

  // Auth every socket connection with the same JWT used by REST calls
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Unauthorized"));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = payload.id;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.userId}`); // private room per user

    socket.on("typing", ({ chatId, isTyping }) => {
      socket.to(`user:${socket.userId}`).emit("typing:update", { chatId, isTyping });
    });

    socket.on("message:read", ({ waMessageId }) => {
      // mark read + emit blue-tick receipt update to sender's own room
      io.to(`user:${socket.userId}`).emit("receipt:update", { waMessageId, status: "read" });
    });

    socket.on("disconnect", () => {
      // cleanup if needed
    });
  });

  return io;
}

module.exports = { initSocketServer };
