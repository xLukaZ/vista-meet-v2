/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@meet-vista/core",
    "@meet-vista/meeting-core",
    "@meet-vista/presence-core",
    "@meet-vista/matterport-runtime",
    "@meet-vista/matterport-objects",
  ],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' cdn.vista-meet.com static.matterport.com",
              "frame-src my.matterport.com",
              "connect-src 'self' wss: https:",
              "img-src 'self' data: blob: https:",
              "media-src 'self' blob:",
            ].join("; "),
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
