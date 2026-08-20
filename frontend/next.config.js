/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // 'export' output needed when packaging for Capacitor/Android
  ...(process.env.CAPACITOR_BUILD === "true" ? { output: "export" } : {}),
};
