import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Self-contained server in .next/standalone, for the Fly.io Docker image.
  output: "standalone",
  // Let a phone load the dev server through a tunnel or over the local network.
  allowedDevOrigins: ["*.trycloudflare.com", "*.ngrok-free.app", "192.168.*.*", "10.*.*.*"],
};

export default nextConfig;
