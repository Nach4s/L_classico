import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable React strict mode for catching bugs early
  reactStrictMode: true,

  // Allow images from external domains if needed later
  images: {
    remotePatterns: [],
  },

  // Enable experimental features for App Router
  experimental: {
    // Allows server actions in forms
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
