import type { MetadataRoute } from "next";
import { ORIGIN } from "@/lib/chain";
import { listCertificates, listWatches } from "@/lib/store";
import { SAMPLE_MODE } from "@/lib/seed";

export const revalidate = 3600;

/**
 * The static routes always, and the records only once they are real.
 *
 * Submitting the fourteen seeded demonstrations to search engines would put
 * invented certificates on reserved example domains into the index, where they
 * would outlive the banner explaining that they are not captures. This product
 * exists because a convincing fake record is harmful, so in sample mode the
 * sitemap stops at the pages that describe the product.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = [
    { url: `${ORIGIN}/`, priority: 1 },
    { url: `${ORIGIN}/verify`, priority: 0.8 },
    { url: `${ORIGIN}/watch`, priority: 0.6 },
    { url: `${ORIGIN}/api`, priority: 0.5 },
  ];

  if (SAMPLE_MODE) return pages;

  const [certs, watches] = await Promise.all([
    listCertificates(1000),
    listWatches(),
  ]);

  return [
    ...pages,
    ...certs.map((c) => ({
      url: `${ORIGIN}/c/${c.id}`,
      lastModified: new Date(`${c.at}Z`),
      priority: 0.7,
    })),
    ...watches.map((w) => ({
      url: `${ORIGIN}/w/${w.id}`,
      lastModified: w.lastChecked ? new Date(`${w.lastChecked}Z`) : undefined,
      priority: 0.4,
    })),
  ];
}
