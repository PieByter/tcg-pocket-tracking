import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PocketLedger — TCG Pocket Multi-Account Tracker",
    short_name: "PocketLedger",
    description:
      "Ledger, deficit radar, and daily transfer planner for multiple Pokémon TCG Pocket accounts.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0f131d",
    theme_color: "#0f131d",
    orientation: "any",
    categories: ["utilities", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
