import type { NextConfig } from "next";
import path from "path";

// PWA module ko require karna padega kyunki ye commonjs use karta hai
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development", // Dev mode mein cache band rahega
});

const nextConfig: NextConfig = {
  // Purane settings: sharp aur bcryptjs ko external rakha hai
  serverExternalPackages: ["sharp", "bcryptjs", "@whiskeysockets/baileys"],
  
  // Cloudinary images allow karne ke liye
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },

  // Tumhara purana Turbopack setting
  turbopack: {
    root: path.resolve(__dirname),
  },

  // Build optimize karne ke liye
  typescript: {
    ignoreBuildErrors: true, // Deploy ke waqt choti-moti errors ignore karega
  },
};

export default withPWA(nextConfig);
