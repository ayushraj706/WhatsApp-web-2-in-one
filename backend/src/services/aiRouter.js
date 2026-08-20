/**
 * aiRouter.js — the "Automation Engine" brain.
 *
 * Implements the AI Settings Page rules:
 *  a) manual model selection
 *  b) automatic mode (pick model by prompt complexity)
 *  c) "always largest" vs "always fastest" policy
 *  d) confirmation-before-send gate
 */
const { callOpenAI, callGemini, callAnthropic } = require("./aiProviders");

// Model tiers per provider — extend as new models ship.
const MODEL_TIERS = {
  openai: { largest: "gpt-4o", fastest: "gpt-4o-mini" },
  gemini: { largest: "gemini-1.5-pro", fastest: "gemini-1.5-flash" },
  anthropic: { largest: "claude-opus-4-8", fastest: "claude-haiku-4-5-20251001" },
};

const PROVIDER_FN = {
  openai: callOpenAI,
  gemini: callGemini,
  anthropic: callAnthropic,
};

/**
 * Very lightweight complexity heuristic for "Automatic Mode".
 * Swap with an actual classifier model if you want something smarter —
 * intentionally kept cheap/fast so it doesn't add latency to every reply.
 */
function estimateComplexity(prompt) {
  const len = prompt.length;
  const hasCode = /```|function |class |SELECT |import /i.test(prompt);
  const hasMultiStep = /step|first.*then|explain|analy[sz]e|compare/i.test(prompt);

  let score = 0;
  if (len > 300) score += 2;
  else if (len > 100) score += 1;
  if (hasCode) score += 2;
  if (hasMultiStep) score += 1;

  return score >= 3 ? "high" : score >= 1 ? "medium" : "low";
}

/**
 * Decide which provider + model to use, based on the user's saved settings.
 * user = { aiMode, aiSizePolicy, aiSelectedModel, aiApiKeys }
 */
function resolveModel(user, prompt) {
  const provider = user.aiPreferredProvider || "openai";
  const tiers = MODEL_TIERS[provider];

  if (user.aiMode === "manual") {
    return { provider, model: user.aiSelectedModel || tiers.fastest };
  }

  // aiMode === "automatic"
  if (user.aiSizePolicy === "largest") return { provider, model: tiers.largest };
  if (user.aiSizePolicy === "fastest") return { provider, model: tiers.fastest };

  // aiSizePolicy === "auto" -> decide by prompt complexity
  const complexity = estimateComplexity(prompt);
  const model = complexity === "high" ? tiers.largest : tiers.fastest;
  return { provider, model, complexity };
}

/**
 * Main entry point called from routes/aiRoutes.js and the auto-reply hook.
 * Returns either the generated reply, or a "pending confirmation" object
 * if the user has aiRequireConfirmation = true.
 */
async function generateAutoReply(user, incomingMessage) {
  const { provider, model } = resolveModel(user, incomingMessage);
  const apiKey = user.aiApiKeys?.[provider]; // per-user BYO key, else falls back to server default
  const fn = PROVIDER_FN[provider];

  const reply = await fn(model, incomingMessage, apiKey);

  if (user.aiRequireConfirmation) {
    return { status: "pending_confirmation", provider, model, draftReply: reply };
  }
  return { status: "sent", provider, model, reply };
}

module.exports = { resolveModel, generateAutoReply, estimateComplexity };
