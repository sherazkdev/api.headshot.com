/** @type {import('next').NextConfig} */
const apiPort = process.env.API_PORT || "3016";

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api-proxy/:path*",
        destination: `http://127.0.0.1:${apiPort}/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
