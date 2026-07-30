import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * Default adapter config. Incremental cache and tag revalidation are left off
 * until there is real ISR content to cache — turning them on requires a KV
 * namespace and a D1 database, which would otherwise sit empty.
 */
export default defineCloudflareConfig();
