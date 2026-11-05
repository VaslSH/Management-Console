import type { NextConfig } from 'next';

// GitHub project Pages serves the site at /<repo>/. The media server serves the
// same export at /. Set BASE_PATH only for the Pages build.
function pagesBasePath(value: string | undefined) {
  const path = value?.trim().replace(/\/$/, '') ?? '';
  if (!path || path === '/') return undefined;
  return path.startsWith('/') ? path : `/${path}`;
}

const basePath = pagesBasePath(process.env.BASE_PATH);

const nextConfig: NextConfig = {
  output: process.env.BUILD_STATIC === 'true' ? 'export' : undefined,
  ...(basePath ? { basePath } : {}),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath ?? ''
  },
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  compiler: {
    removeConsole: false
  },
  async rewrites() {
    if (process.env.BUILD_STATIC === 'true') return [];
    return [
      {
        source: '/rest/:path*',
        destination: 'http://127.0.0.1:5080/rest/:path*'
      }
    ];
  }
};

export default nextConfig;
