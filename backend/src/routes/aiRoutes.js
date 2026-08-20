const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { aiLimiter } = require("../middleware/rateLimiter");
const { generateAutoReply } = require("../services/aiRouter");
const User = require("../models/User");
const router = express.Router();

// Update AI Settings Page preferences
router.put("/settings", requireAuth, async (req, res) => {
  const { aiEnabled, aiMode, aiSelectedModel, aiSizePolicy, aiRequireConfirmation, aiPreferredProvider } = req.body;
  await User.update(
    { aiEnabled, aiMode, aiSelectedModel, aiSizePolicy, aiRequireConfirmation, aiPreferredProvider },
    { where: { id: req.user.id } }
  );
  res.json({ success: true });
});

// Manually trigger / test a reply generation (also used by the confirmation flow)
router.post("/generate-reply", requireAuth, aiLimiter, async (req, res) => {
  const { message } = req.body;
  const user = await User.findByPk(req.user.id);
  if (!user.aiEnabled) return res.status(400).json({ error: "AI automation disabled" });

  const result = await generateAutoReply(user, message);
  res.json(result);
});

module.exports = router;
