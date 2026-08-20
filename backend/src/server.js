require("dotenv").config();
const express = require("express");
const http = require("http");
const helmet = require("helmet");
const cors = require("cors");
const { sequelize } = require("./config/db");
const { apiLimiter } = require("./middleware/rateLimiter");
const { sanitizeBody } = require("./middleware/sanitize");
const authRoutes = require("./routes/authRoutes");
const aiRoutes = require("./routes/aiRoutes");
const waRoutes = require("./routes/waRoutes");
const { initSocketServer } = require("./sockets/socketServer");
const logger = require("./utils/logger");

const app = express();
const server = http.createServer(app);

// --- Security middleware ---
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: "5mb" }));
app.use(sanitizeBody); // strips script/HTML injection from every request body
app.use("/api", apiLimiter); // global rate limit

// --- Routes (all AI keys & WA logic stay server-side, never sent to client) ---
app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/wa", waRoutes);

app.get("/health", (req, res) => res.json({ status: "ok" }));

// --- Real-time layer (chat events, anti-delete, typing, receipts) ---
const io = initSocketServer(server);
app.set("io", io);

const PORT = process.env.PORT || 5000;
sequelize.sync().then(() => {
  server.listen(PORT, () => logger.info(`Backend running on port ${PORT}`));
});
