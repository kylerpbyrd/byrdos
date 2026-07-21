import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@byrdos/ui', '@byrdos/auth'],
};

export default nextConfig;
