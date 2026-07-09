import { fileURLToPath } from "node:url";
import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to the app dir (there are stray lockfiles above it).
  turbopack: { root: path.dirname(fileURLToPath(import.meta.url)) },
  // The vault (markdown, source of truth) lives outside the app dir and is read
  // at runtime via fs from VAULT_DIR — never bundled.
  serverExternalPackages: ["simple-git", "gray-matter", "chokidar"],
};

export default nextConfig;
