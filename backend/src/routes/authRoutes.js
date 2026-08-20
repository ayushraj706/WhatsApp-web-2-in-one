const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const router = express.Router();

/**
 * OAuth handoff endpoint: NextAuth.js on the frontend handles the
 * Google/GitHub OAuth flow itself, then calls this endpoint with the
 * verified profile to mint OUR OWN short-lived JWT for API/socket auth.
 * No passwords, no basic login, anywhere in this codebase.
 */
router.post("/oauth-login", async (req, res) => {
  const { email, name, avatarUrl, provider, oauthId } = req.body;
  if (!email || !provider || !oauthId) {
    return res.status(400).json({ error: "Missing OAuth profile fields" });
  }

  const [user] = await User.findOrCreate({
    where: { oauthProvider: provider, oauthId },
    defaults: { email, name, avatarUrl, oauthProvider: provider, oauthId },
  });

  const token = jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );

  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

module.exports = router;
