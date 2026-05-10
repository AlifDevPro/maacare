import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["tesseract.js", "tesseract.js-core"],
  allowedDevOrigins: ['192.168.0.107'],
};

export default nextConfig;
