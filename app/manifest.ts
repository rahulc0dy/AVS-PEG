import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AVS-PEG",
    short_name: "AVS-PEG",
    description:
      "Autonomous Vehicle Simulation with Procedural Environment Generation",
    start_url: "/",
    display: "standalone",
    background_color: "#131313",
    theme_color: "#000000",
    icons: [
      {
        src: "/site-icons/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/site-icons/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
