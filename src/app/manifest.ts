import type { MetadataRoute } from "next";
import { APP_META } from "@/lib/salon";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_META.title,
    short_name: APP_META.shortName,
    description: APP_META.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#8272a3",
    lang: "uk",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
