import { PUBLIC_ROUTES, absoluteUrl } from "@/lib/public-routes";
import { site } from "@/lib/site";

export const dynamic = "force-static";

/** XML text nodes must not carry raw markup delimiters. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Atom rather than RSS: it requires absolute IDs and explicit updated stamps,
 * which is exactly the discipline that keeps a feed trustworthy to aggregators
 * and to the AI pipelines that still ingest feeds.
 */
export async function GET() {
  const latest = PUBLIC_ROUTES.reduce(
    (newest, route) => (route.updated > newest ? route.updated : newest),
    PUBLIC_ROUTES[0].updated,
  );

  const entries = PUBLIC_ROUTES.map((route) => {
    const url = absoluteUrl(route.path);
    return [
      "  <entry>",
      `    <title>${escapeXml(route.title)}</title>`,
      `    <link href="${escapeXml(url)}" />`,
      `    <id>${escapeXml(url)}</id>`,
      `    <updated>${new Date(route.updated).toISOString()}</updated>`,
      `    <summary>${escapeXml(route.summary)}</summary>`,
      "  </entry>",
    ].join("\n");
  });

  const body = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    `  <title>${escapeXml(site.name)}</title>`,
    `  <subtitle>${escapeXml(site.tagline)}</subtitle>`,
    `  <link href="${escapeXml(absoluteUrl("/feed.xml"))}" rel="self" />`,
    `  <link href="${escapeXml(site.url)}" />`,
    `  <id>${escapeXml(site.url)}/</id>`,
    `  <updated>${new Date(latest).toISOString()}</updated>`,
    `  <author><name>${escapeXml(site.name)}</name></author>`,
    ...entries,
    "</feed>",
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
