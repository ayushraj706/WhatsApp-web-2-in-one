require('dotenv').config();
const express = require('express');
const cors = require('cors');

// 1. WhatsApp Engine Import (BaseKey CRM Core)
// FIX: Naam 'startSession' kar diya gaya hai, jo session.js export kar raha hai
const { startSession } = require('./whatsapp/session');

// 2. Route Imports
const authRoutes = require('./routes/auth');
const chatsRoutes = require('./routes/chats');
const messagesRoutes = require('./routes/messages');
const bulkRoutes = require('./routes/bulk');
const settingsRoutes = require('./routes/settings');
const webhookRoutes = require('./routes/webhook');
const statusRoutes = require('./routes/status');

const app = express();

// 3. Bulletproof CORS Policy (Yeh Vercel ko kabhi block nahi karega)
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));

// 4. Request Tracker (Isse pata chalega ki connection juda ya nahi)
app.use((req, res, next) => {
  console.log(`[Rasta Check] Browser ne request bheji: ${req.method} ${req.url}`);
  next();
});

app.use(express.json({ limit: '2mb' })); // JSON bodies only

// 5. Cron-Job / Uptime Ping Tracker (Pura foolproof)
app.get('/', (req, res) => {
  res.status(200).send('BaseKey WhatsApp API is Zinda! 🚀 (Server Active)');
});

app.get('/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

// 6. API Routes Mount
app.use('/api/auth', authRoutes);
app.use('/api/chats', chatsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/bulk', bulkRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/status', statusRoutes);

// 7. Global Error Handler (Taaki app crash na ho)
app.use((err, req, res, next) => {
  console.error('[Server Error]:', err.message);
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// 8. Log RSS memory usage periodically
setInterval(() => {
  const mb = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
  console.log(`[memory] RSS: ${mb} MB`);
}, 60000);

const PORT = process.env.PORT || 5000;

// 9. Boot Server and WhatsApp Session together
app.listen(PORT, async () => {
  console.log(`[server] listening on port ${PORT}`);
  
  // WhatsApp Bot ko zinda karne ka trigger yahan add kiya hai
  try {
    console.log('[system] Starting WhatsApp Baileys Engine...');
    
    // FIX: Sahi function call kiya gaya hai
    await startSession();
    
  } catch (error) {
    console.error('[system] Failed to start WhatsApp session:', error);
  }
});
