import type { NextConfig } from "next";

const staticSite = process.env.NEXT_PUBLIC_STATIC_SITE === "1";

const nextConfig: NextConfig = {
  ...(staticSite
    ? { output: "export" as const, images: { unoptimized: true } }
    : { cacheComponents: true, partialPrefetching: true }),
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
