import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;

// Enables Cloudflare bindings (Hyperdrive, env, etc.) during `next dev` only.
// Must NOT run during `next build`: it spawns wrangler/getPlatformProxy, whose
// pipe dies on CI/Vercel and surfaces as an unhandled `write EPIPE` rejection
// that crashes the build. NODE_ENV is "development" only for `next dev`.
if (process.env.NODE_ENV === "development") {
  import("@opennextjs/cloudflare").then(({ initOpenNextCloudflareForDev }) => {
    initOpenNextCloudflareForDev();
  });
}
