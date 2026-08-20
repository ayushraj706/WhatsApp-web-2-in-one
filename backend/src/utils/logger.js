const pino = require("pino");
module.exports = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  transport: process.env.NODE_ENV === "production" ? undefined : { target: "pino-pretty" },
});
