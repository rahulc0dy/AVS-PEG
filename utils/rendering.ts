import { Color, PerspectiveCamera, Scene, WebGLRenderer } from "three";

interface CameraConfig {
  fov?: number;
  aspect?: number;
  near?: number;
  far?: number;
}

interface CameraPosition {
  x?: number;
  y?: number;
  z?: number;
}

interface SceneOptions {
  cameraConfig?: CameraConfig;
  cameraPosition?: CameraPosition;
  bgColor?: number;
}

export const setupScene = (
  mount: HTMLDivElement | null,
  options: SceneOptions = {}
) => {
  const {
    cameraConfig = {},
    cameraPosition = {},
    bgColor = 0x0b0b0f,
  } = options;

  const { fov = 10, aspect = 16 / 9, near = 0.1, far = 1000 } = cameraConfig;
  const { x = 0, y = 0, z = 5 } = cameraPosition;
  if (!mount) throw new Error("Mount element not ready");

  const scene = new Scene();
  scene.background = new Color(bgColor);

  const camera = new PerspectiveCamera(
    fov,
    mount.clientWidth / mount.clientHeight || aspect,
    near,
    far
  );
  camera.position.set(x, y, z);

  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setSize(mount.clientWidth, mount.clientHeight);
  mount.appendChild(renderer.domElement);

  return { scene, camera, renderer };
};
