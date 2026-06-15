/** @type {import('next').NextConfig} */
const nextConfig = {
  // "standalone" output is needed for the docker-compose frontend image
  // (Dockerfile copies .next/standalone + server.js), but it conflicts with
  // Vercel's own serverless-function tracing during "Collecting build
  // traces" and breaks Vercel deploys. Vercel sets VERCEL=1 during builds.
  output: process.env.VERCEL ? undefined : "standalone",
  images: {
    remotePatterns: [
      { protocol: "http",  hostname: "localhost",     port: "8000" },
      { protocol: "https", hostname: "**.onrender.com" },
      { protocol: "https", hostname: "**.r2.dev" },
    ],
  },
};

export default nextConfig;
