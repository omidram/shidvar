import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: projectRoot,
  cleanDistDir: false,
  typescript: { ignoreBuildErrors: true },
  serverExternalPackages: ["@prisma/client", "prisma", "bcryptjs", "ioredis"],
  async redirects() {
    return [
      { source: "/supplier", destination: "/requester/dashboard", permanent: false },
      { source: "/supplier/:path*", destination: "/requester/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
