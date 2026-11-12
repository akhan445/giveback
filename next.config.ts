import type { NextConfig } from "next";

// The app lives under /vendor/*; the old top-level URLs keep working.
const moved: Record<string, string> = {
  '/pos': '/vendor/counter',
  '/overview': '/vendor/dashboard',
  '/cashback': '/vendor/cashback',
  '/dashboard': '/vendor/reports',
  '/settings': '/vendor/settings',
};

const nextConfig: NextConfig = {
  devIndicators: false,
  async redirects() {
    return Object.entries(moved).map(([source, destination]) => ({ source, destination, permanent: false }));
  },
};

export default nextConfig;
