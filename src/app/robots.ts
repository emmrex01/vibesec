import type { MetadataRoute } from "next";
import { publicEnv } from "@/config/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/report"] }],
    sitemap: `${publicEnv.siteUrl}/sitemap.xml`,
  };
}
