/** @type {import('next').NextConfig} */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const securityHeaders = [
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options",     value: "nosniff" },
  // Allow framing only from same origin (protect against clickjacking)
  { key: "X-Frame-Options",            value: "SAMEORIGIN" },
  // Legacy XSS protection (Chrome removed it, but harmless for older browsers)
  { key: "X-XSS-Protection",           value: "1; mode=block" },
  // Don't send full referrer to cross-origin requests
  { key: "Referrer-Policy",            value: "strict-origin-when-cross-origin" },
  // Disable unnecessary browser features
  { key: "Permissions-Policy",         value: "camera=(), microphone=(), geolocation=()" },
  // Prevent cross-origin window opener attacks
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig = {
  skipTrailingSlashRedirect: true,
  // "standalone" output is needed for the docker-compose frontend image
  // (Dockerfile copies .next/standalone + server.js), but it conflicts with
  // Vercel's own serverless-function tracing during "Collecting build
  // traces" and breaks Vercel deploys. Vercel sets VERCEL=1 during builds.
  output: process.env.VERCEL ? undefined : "standalone",

  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },

  async rewrites() {
    return [
      {
        source: "/api/:path(.*)",
        destination: `${API_URL}/api/:path`,
      },
    ];
  },

  images: {
    remotePatterns: [
      { protocol: "http",  hostname: "localhost", port: "8000" },
      { protocol: "https", hostname: "**.onrender.com" },
      { protocol: "https", hostname: "**.r2.dev" },
    ],
  },
};

export default nextConfig;
