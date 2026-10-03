const allowSkipTypeCheck = process.env.NEXT_SKIP_BUILD_TYPECHECK === "1";
const allowSkipLintDuringBuild = process.env.NEXT_SKIP_BUILD_LINT === "1";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: allowSkipTypeCheck,
  },
  eslint: {
    ignoreDuringBuilds: allowSkipLintDuringBuild,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
