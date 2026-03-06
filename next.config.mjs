/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  experimental: {
    serverComponentsExternalPackages: ["node-pty"],
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
};

export default nextConfig;
