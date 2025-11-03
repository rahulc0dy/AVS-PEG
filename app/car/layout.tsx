import { CarSceneProvider } from "@/components/car-scene-provider";
import Stats from "three/examples/jsm/libs/stats.module.js";

export default function CarPageLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <CarSceneProvider>{children}</CarSceneProvider>;
}
