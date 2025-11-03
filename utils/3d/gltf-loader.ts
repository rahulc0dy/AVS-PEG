import { Scene } from "three";
import { GLTFLoader } from "three/examples/jsm/Addons.js";

export const gltfLoader = (assetPath: string) => {
  const loader = new GLTFLoader();
  loader.load(assetPath, (gltfScene) => {});
};
