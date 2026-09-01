import type { NextConfig } from "next";

const connectSources = [
  "'self'",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
  "https://*.yourdomain.com",
  "https://*.onrender.com",
  "https://panda-vault.onrender.com",
  "https://panda-vault-backend.onrender.com",
  "https://*.vercel.app",
  "https://*.railway.app",
  "ws://localhost:3000",
  "wss://localhost:3000",
  "ws://127.0.0.1:3000",
];

if (process.env.NEXT_PUBLIC_API_URL) {
  connectSources.push(process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, ''));
}

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      `connect-src ${Array.from(new Set(connectSources)).join(" ")}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
