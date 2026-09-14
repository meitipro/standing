import type { MetadataRoute } from "next";

import { ORIGIN } from "@/lib/chain";
import { listCertificates, listWatches } from "@/lib/store";

export const revalidate = 3600;

/** The static routes, and the newest records the chain holds. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = [
    { url: `${ORIGIN}/`, priority: 1 },
    { url: `${ORIGIN}/verify`, priority: 0.8 },
    { url: `${ORIGIN}/watch`, priority: 0.6 },
    { url: `${ORIGIN}/bulk`, priority: 0.5 },
    { url: `${ORIGIN}/api`, priority: 0.5 },
  ];
  const [certs, watches] = await Promise.all([listCertificates(25), listWatches()]);
  return [
    ...pages,
    ...certs.map((c) => ({ url: `${ORIGIN}/c/${c.id}`, lastModified: new Date(`${c.at}Z`), priority: 0.7 })),
    ...watches.map((w) => ({
      url: `${ORIGIN}/w/${w.id}`,
      lastModified: w.lastChecked ? new Date(`${w.lastChecked}Z`) : undefined,
      priority: 0.4,
    })),
  ];
}
