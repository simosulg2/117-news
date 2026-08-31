import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    const privateHeaders = [
      { key: "Cache-Control", value: "private, no-store, max-age=0" },
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
    ];
    return [
      { source: "/ajakava/:path*", headers: privateHeaders },
      { source: "/sisene", headers: privateHeaders },
    ];
  },
};

export default nextConfig;
