import { defineCloudflareConfig } from "@opennextjs/cloudflare"

/**
 * OpenNext → Cloudflare Workers configuration.
 * Defaults are fine for this app (Server Actions, dynamic SSR). Incremental
 * cache / tag cache can be added later with R2/D1/KV if needed.
 */
export default defineCloudflareConfig({})
