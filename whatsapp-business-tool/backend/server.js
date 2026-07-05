require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const chatsRoutes = require('./routes/chats');
const messagesRoutes = require('./routes/messages');
const bulkRoutes = require('./routes/bulk');
const settingsRoutes = require('./routes/settings');
const webhookRoutes = require('./routes/webhook');
const statusRoutes = require('./routes/status');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' })); // JSON bodies only - media goes via multipart, never base64 in JSON

app.get('/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

app.use('/api/auth', authRoutes);
app.use('/api/chats', chatsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/bulk', bulkRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/status', statusRoutes);

// Log RSS memory usage periodically - handy for confirming we stay under
// the 500MB budget on Render/small VPS during real usage.
setInterval(() => {
  const mb = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
  console.log(`[memory] RSS: ${mb} MB`);
}, 60000);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`[server] listening on port ${PORT}`));
