import { JsonLd } from "@/components/json-ld";
import { PUBLIC_ROUTES } from "@/lib/public-routes";
import { buildGraph } from "@/lib/schema";

/**
 * Graph for a legal document, including the breadcrumb that mirrors the visible
 * path. Reads the route inventory so the title, summary and modified date can
 * never drift from the sitemap and feed.
 */
export function LegalPageSchema({ path, name }: { path: string; name: string }) {
  const route = PUBLIC_ROUTES.find((r) => r.path === path);
  if (!route) return null;

  return (
    <JsonLd
      data={buildGraph({
        path,
        title: route.title,
        description: route.summary,
        updated: route.updated,
        breadcrumbs: [
          { name: "Home", path: "/" },
          { name: name, path },
        ],
      })}
    />
  );
}
