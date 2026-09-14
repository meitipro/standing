/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // /api/contract-source reads the contract off disk at request time. The
    // serverless bundle only carries files something imports, so this one is
    // named explicitly, or the route answers with nothing once deployed.
    outputFileTracingIncludes: {
      "/api/contract-source": ["./contracts/standing.py"],
    },
  },
};

export default nextConfig;
