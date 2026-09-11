import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "mmosm Accounting",
    short_name: "mmosm",
    start_url: "/",
    display: "standalone",
    background_color: "#38040e",
    theme_color: "#38040e",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
