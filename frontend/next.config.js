/** @type {import('next').NextConfig} */
const nextConfig = {
  // Proxy all /api/* calls to the FastAPI backend.
  // In Docker: BACKEND_URL=http://backend:8000 (internal network).
  // Locally without Docker: falls back to http://localhost:8000.
  //
  // Why a proxy? httpOnly cookies are scoped to the domain that sets them.
  // If the browser called :8000 directly, the cookie would live on :8000 and
  // could not be sent to :3000 (or vice-versa). Proxying through Next.js means
  // the browser always talks to :3000, so the cookie is set and read on the
  // same origin — samesite=lax works correctly with zero special-casing.
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
