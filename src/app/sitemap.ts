import type { MetadataRoute } from "next";
import { publicEnv } from "@/config/env";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/assessment", "/services", "/about", "/contact", "/privacy", "/terms", "/disclaimer"].map((p) => ({
    url: `${publicEnv.siteUrl}${p}`,
    changeFrequency: "monthly",
    priority: p === "" ? 1 : 0.6,
  }));
}
