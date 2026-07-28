import type { MetadataRoute } from "next";
import { ORIGIN } from "@/lib/chain";

/**
 * Certificates are meant to be found and cited, so nothing here is hidden from
 * crawlers except the json api, which has no reason to be indexed and whose
 * urls a search engine would only ever show to somebody who wanted the page.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: "/api/" }],
    sitemap: `${ORIGIN}/sitemap.xml`,
  };
}
