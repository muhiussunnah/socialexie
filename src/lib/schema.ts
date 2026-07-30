import { PLANS } from "@/lib/plans";
import { PLATFORM_LIST } from "@/lib/platforms";
import { absoluteUrl } from "@/lib/public-routes";
import { site } from "@/lib/site";

/**
 * One connected JSON-LD graph per page.
 *
 * Isolated schema blocks that never reference each other are markup; a graph
 * where the page points at the site, which points at the organization, is an
 * entity model — and that is what knowledge graphs and retrieval layers
 * actually consume. Every node therefore carries a stable `@id`.
 *
 * Nothing here is asserted that the product cannot back up: there is no
 * aggregateRating without reviews, and no SearchAction without a search
 * endpoint. Invented trust signals are worse than absent ones.
 */

const ORG_ID = `${site.url}/#organization`;
const SITE_ID = `${site.url}/#website`;
const APP_ID = `${site.url}/#software`;

export interface BreadcrumbEntry {
  name: string;
  path: string;
}

interface GraphOptions {
  /** Route path, e.g. "/pricing". */
  path: string;
  title: string;
  description: string;
  /** ISO date the page content last changed. */
  updated: string;
  /** Omitted on the home page, where a breadcrumb would be a single item. */
  breadcrumbs?: BreadcrumbEntry[];
  /** Include the product node — true on pages that describe the product. */
  includeApp?: boolean;
}

function organization() {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: site.name,
    url: `${site.url}/`,
    description: site.description,
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl("/icons/icon.svg"),
      width: 512,
      height: 512,
    },
  };
}

function website() {
  return {
    "@type": "WebSite",
    "@id": SITE_ID,
    url: `${site.url}/`,
    name: site.name,
    description: site.description,
    inLanguage: "en",
    publisher: { "@id": ORG_ID },
  };
}

/**
 * The product itself. `offers` mirrors the pricing page exactly — a schema
 * price that disagrees with the visible price is a rich-result violation.
 */
function softwareApplication() {
  return {
    "@type": "SoftwareApplication",
    "@id": APP_ID,
    name: site.name,
    url: `${site.url}/`,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Social Media Management",
    operatingSystem: "Web",
    description: site.description,
    publisher: { "@id": ORG_ID },
    featureList: [
      "Multi-network publishing",
      "Timezone-aware scheduling queue",
      "Evergreen content recycling",
      "AI image and caption studio",
      "Comment-to-DM automation",
      "Shares and saves analytics",
    ],
    softwareHelp: { "@id": `${absoluteUrl("/legal/security")}#webpage` },
    offers: PLANS.flatMap((plan) => [
      {
        "@type": "Offer",
        name: `${plan.name} (monthly)`,
        price: (plan.priceCents.monthly / 100).toFixed(2),
        priceCurrency: "USD",
        url: absoluteUrl("/pricing"),
        availability: "https://schema.org/InStock",
        category: "subscription",
      },
      {
        "@type": "Offer",
        name: `${plan.name} (one-time licence)`,
        price: (plan.priceCents.lifetime / 100).toFixed(2),
        priceCurrency: "USD",
        url: absoluteUrl("/pricing"),
        availability: "https://schema.org/InStock",
        category: "one-time",
      },
    ]),
    // Cheap, true entity signals: what the product is actually about.
    about: PLATFORM_LIST.map((platform) => ({
      "@type": "Thing",
      name: platform.name,
    })),
  };
}

export function buildGraph(options: GraphOptions) {
  const url = absoluteUrl(options.path);
  const modified = new Date(options.updated).toISOString();

  const webPage: Record<string, unknown> = {
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: options.title,
    description: options.description,
    inLanguage: "en",
    isPartOf: { "@id": SITE_ID },
    dateModified: modified,
    about: { "@id": ORG_ID },
  };

  const graph: Record<string, unknown>[] = [organization(), website(), webPage];

  if (options.breadcrumbs?.length) {
    const breadcrumbId = `${url}#breadcrumb`;
    webPage.breadcrumb = { "@id": breadcrumbId };
    graph.push({
      "@type": "BreadcrumbList",
      "@id": breadcrumbId,
      itemListElement: options.breadcrumbs.map((crumb, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: crumb.name,
        item: absoluteUrl(crumb.path),
      })),
    });
  }

  if (options.includeApp) {
    webPage.mainEntity = { "@id": APP_ID };
    graph.push(softwareApplication());
  }

  return { "@context": "https://schema.org", "@graph": graph };
}
