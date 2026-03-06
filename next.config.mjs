/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // node-pty is server-side only (exclude from bundling)
    serverComponentsExternalPackages: ["node-pty"],
  },
};

export default nextConfig;
