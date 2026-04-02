const path = require("path");

const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

/** @type {import('next').NextConfig} */
const isNativeExport = process.env.NEXT_OUTPUT_MODE === "export";

const nextConfig = {
  reactStrictMode: true,
  output: isNativeExport ? "export" : "standalone",
  trailingSlash: isNativeExport,
  outputFileTracingRoot: path.join(__dirname),
  images: {
    unoptimized: isNativeExport,
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
};

module.exports = withPWA(nextConfig);
