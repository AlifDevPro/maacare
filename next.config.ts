import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["tesseract.js", "tesseract.js-core", "firebase-admin"],
  allowedDevOrigins: ["192.168.0.107"],
};

export default nextConfig;
