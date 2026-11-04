import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  images: {
    // Thumbnail dari CDN sumber. Secara default optimasi Next dimatikan agar
    // kuota image optimization Vercel tidak habis; set NEXT_IMAGE_OPTIMIZED=1
    // (saat build) untuk mengaktifkan optimizer bawaan Next.
    unoptimized: process.env.NEXT_IMAGE_OPTIMIZED !== "1",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
        pathname: "/flibustier/pokemon-tcg-exchange/**",
      },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
