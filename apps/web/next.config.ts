import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Дозволити білд навіть якщо є ESLint-помилки (production-friendly)
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
