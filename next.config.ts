import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // REMOVIDO: ignoreBuildErrors: true
    // TypeScript errors devem ser corrigidos, não ignorados
  },
  eslint: {
    // REMOVIDO: ignoreDuringBuilds: true
    // Lint errors devem ser tratados no CI/CD
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
  webpack: (config) => {
    config.optimization.splitChunks = {
      chunks: "all",
      cacheGroups: {
        // Separa bibliotecas grandes em bundles distintos
        recharts: {
          test: /[\\/]node_modules[\\/](recharts)[\\/]/,
          name: "recharts",
          priority: 10,
        },
        pdfRenderer: {
          test: /[\\/]node_modules[\\/](@react-pdf|jspdf)[\\/]/,
          name: "pdf-renderer",
          priority: 10,
        },
        genkit: {
          test: /[\\/]node_modules[\\/](@genkit|genkit)[\\/]/,
          name: "genkit-ai",
          priority: 10,
        },
        firebase: {
          test: /[\\/]node_modules[\\/](firebase)[\\/]/,
          name: "firebase",
          priority: 9,
        },
      },
    };
    return config;
  },
};

export default nextConfig;
