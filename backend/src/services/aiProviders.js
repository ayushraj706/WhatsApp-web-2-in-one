/**
 * aiProviders.js — thin adapters around each AI SDK.
 * API keys are read ONLY from server env / encrypted DB fields.
 * They are never sent to, or accepted from, the frontend.
 */
const OpenAI = require("openai");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Anthropic = require("@anthropic-ai/sdk");

async function callOpenAI(model, prompt, apiKey) {
  const client = new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY });
  const res = await client.chat.completions.create({
    model, // e.g. "gpt-4o" (large) or "gpt-4o-mini" (fast)
    messages: [{ role: "user", content: prompt }],
    max_tokens: 500,
  });
  return res.choices[0].message.content;
}

async function callGemini(model, prompt, apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey || process.env.GEMINI_API_KEY);
  const gModel = genAI.getGenerativeModel({ model }); // "gemini-1.5-pro" | "gemini-1.5-flash"
  const res = await gModel.generateContent(prompt);
  return res.response.text();
}

async function callAnthropic(model, prompt, apiKey) {
  const client = new Anthropic({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY });
  const res = await client.messages.create({
    model, // e.g. "claude-opus-4-8" (large) or "claude-haiku-4-5-20251001" (fast)
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });
  return res.content[0].text;
}

module.exports = { callOpenAI, callGemini, callAnthropic };
