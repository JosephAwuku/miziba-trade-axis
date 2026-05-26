import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// Load `.env.local` / `.env` before config export (local dev + build).
const projectDir = process.cwd();
loadEnvConfig(projectDir);

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.100.3'],
};

export default nextConfig;
