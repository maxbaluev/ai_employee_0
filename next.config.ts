import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Remote SVGs are strictly limited to the trusted domains below.
    dangerouslyAllowSVG: true,
    // Allow external toolkit logos served from Composio's CDN mirrors
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.jsdelivr.net",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "logos.composio.dev",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
