import type { NextConfig } from "next";

// Static export: `next build` writes plain files to out/ for Zone's web server, no Node process.
// trailingSlash writes each route as a folder with index.html, which Apache serves without rewrites.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
};

export default nextConfig;
