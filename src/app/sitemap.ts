import type { MetadataRoute } from "next";
import { PUBLIC_ROUTES, absoluteUrl } from "@/lib/public-routes";

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: new Date(route.updated),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
