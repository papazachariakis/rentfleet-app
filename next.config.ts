import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./assets/fonts/**/*",
      "./node_modules/pdfkit/js/data/**/*",
      "./node_modules/pdfkit/js/standard-fonts/**/*",
    ],
  },
  serverExternalPackages: ["pdfkit"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
