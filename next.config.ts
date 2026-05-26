import type { NextConfig } from "next";

const RPC_HOST = process.env.NEXT_PUBLIC_GENLAYER_RPC_URL
  ? new URL(process.env.NEXT_PUBLIC_GENLAYER_RPC_URL).origin
  : "https://studio.genlayer.com";

// Report-only CSP for the pilot. Next.js inlines hydration scripts so a strict
// enforcing CSP would break the app without a nonce-aware setup. Report-only
// gives us telemetry to tune the policy before enforcing.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${RPC_HOST}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Content-Security-Policy-Report-Only", value: csp },
];

const productionHeaders = [
  ...securityHeaders,
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: process.env.NODE_ENV === "production" ? productionHeaders : securityHeaders,
      },
    ];
  },
};

export default nextConfig;
