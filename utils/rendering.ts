import {
  Color,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  AmbientLight,
  DirectionalLight,
} from "three";

/** Partial camera configuration used by `setupScene`. All fields are optional. */
interface CameraConfig {
  /** Vertical field of view in degrees. */
  fov?: number;
  /** Aspect ratio (width / height). If not provided `mount` dimensions are used. */
  aspect?: number;
  /** Near clipping plane. */
  near?: number;
  /** Far clipping plane. */
  far?: number;
}

/** Optional initial camera position. */
interface CameraPosition {
  x?: number;
  y?: number;
  z?: number;
}

/** Options accepted by `setupScene`. */
interface SceneOptions {
  cameraConfig?: CameraConfig;
  cameraPosition?: CameraPosition;
  /** Background color as a hex number (e.g. 0x0b0b0f). */
  bgColor?: number;
}

/**
 * Create a Three.js scene + camera + renderer and attach the renderer's DOM
 * element to `mount`.
 *
 * The function wires up a simple lighting setup, sets the renderer to use
 * requestAnimationFrame via `setAnimationLoop`, and registers a window
 * `resize` handler that keeps the camera and renderer sized to the mount.
 *
 * @param mount - Container element to which the renderer canvas will be appended
 * @param options - Optional configuration for camera, initial position, and background
 * @returns An object containing the `scene`, `camera`, `renderer`, and
 * a `resizeHandler` function (so the caller can remove the event listener
 * if needed).
 */
export const setupScene = (
  mount: HTMLDivElement | null,
  options: SceneOptions = {}
): {
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  resizeHandler: () => void;
} => {
  const {
    cameraConfig = {},
    cameraPosition = {},
    bgColor = 0x0b0b0f,
  } = options;

  const { fov = 10, aspect = 16 / 9, near = 0.1, far = 10000 } = cameraConfig;
  const { x = 0, y = 0, z = 5 } = cameraPosition;
  if (!mount) throw new Error("Mount element not ready");

  // Scene + background
  const scene = new Scene();
  scene.background = new Color(bgColor);

  // Camera setup using mount dimensions when available
  const camera = new PerspectiveCamera(
    fov,
    mount.clientWidth / mount.clientHeight || aspect,
    near,
    far
  );
  camera.position.set(x, y, z);

  // Simple lighting for basic visibility
  const ambient = new AmbientLight(0xffffff, 0.6);
  scene.add(ambient);
  const dir = new DirectionalLight(0xffffff, 0.6);
  dir.position.set(10, 10, 10);
  scene.add(dir);

  // Renderer + DOM attachment
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(mount.clientWidth, mount.clientHeight);
  mount.appendChild(renderer.domElement);

  // Basic render loop. Using `setAnimationLoop` is convenient for WebXR
  // compatibility and ties into the browser's rAF scheduling.
  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
  });

  // Resize handler keeps camera aspect and renderer size in sync with mount
  const resizeHandler = () => {
    if (!mount) return;
    camera.aspect = mount.clientWidth / mount.clientHeight || aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(mount.clientWidth, mount.clientHeight);
  };

  window.addEventListener("resize", resizeHandler);

  return { scene, camera, renderer, resizeHandler };
};
