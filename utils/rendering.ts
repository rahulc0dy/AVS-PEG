import {
  AmbientLight,
  DirectionalLight,
  Material,
  MathUtils,
  PerspectiveCamera,
  Scene,
  Texture,
  Vector3,
  WebGLRenderer,
  CanvasTexture,
  SpriteMaterial,
  Sprite,
} from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { ORBIT_CAM_FAR, ORBIT_CAM_FOV, ORBIT_CAM_NEAR } from "@/env";

/** Minimal disposable contract used for GPU resources. */
interface Disposable {
  dispose: () => void;
}

/**
 * Type guard for objects that implement `dispose()`.
 *
 * @param value - Value to inspect for disposal support.
 * @returns True when `value` has a callable `dispose` method.
 */
const isDisposable = (value: unknown): value is Disposable => {
  if (typeof value !== "object" || value === null) return false;
  return "dispose" in value && typeof value.dispose === "function";
};

/**
 * Create a billboarded text label rendered via an offscreen canvas texture.
 *
 * Text is drawn in bold `sans-serif` on a semi-transparent pill background.
 * The returned sprite has `depthTest`/`depthWrite` disabled and a high
 * `renderOrder` so it draws on top of scene geometry. Dispose with
 * {`@link` disposeTextSprite} to free the underlying `CanvasTexture` and
 * `SpriteMaterial`.
 *
 * `@param` text - Label text to render.
 * `@param` color - CSS color for the text fill. Defaults to `"#ffffff"`.
 * `@returns` A configured `Sprite`, or an empty `Sprite` when a 2D context
 *          cannot be obtained.
 */
export function createTextSprite(
  text: string,
  color: string = "#ffffff",
): Sprite {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) return new Sprite();

  // Set initial font to precisely measure text width
  const fontSize = 80;
  ctx.font = `bold ${fontSize}px sans-serif`;

  const textWidth = ctx.measureText(text).width;
  ctx.canvas.width = Math.max(128, textWidth + 60);
  ctx.canvas.height = 128;

  // Draw background circle or pill
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.beginPath();
  const radius = ctx.canvas.height / 2;
  ctx.arc(radius, radius, radius, Math.PI / 2, (Math.PI * 3) / 2);
  ctx.arc(
    ctx.canvas.width - radius,
    radius,
    radius,
    (Math.PI * 3) / 2,
    Math.PI / 2,
  );
  ctx.closePath();
  ctx.fill();

  // Render text at center
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(text, ctx.canvas.width / 2, ctx.canvas.height / 2 + 5);

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;

  const spriteMaterial = new SpriteMaterial({
    map: texture,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new Sprite(spriteMaterial);

  // Set the sprite's size and center
  const scaleRatio = 12; // Adjustment to convert canvas size to Three.js units appropriately
  sprite.scale.set(
    ctx.canvas.width / scaleRatio,
    ctx.canvas.height / scaleRatio,
    1,
  );
  sprite.renderOrder = 999;

  return sprite;
}

/**
 * Dispose GPU resources allocated by {@link createTextSprite}.
 *
 * @param sprite - Sprite created for text rendering.
 */
export function disposeTextSprite(sprite: Sprite): void {
  const material = sprite.material;
  const materials = Array.isArray(material) ? material : [material];

  for (const currentMaterial of materials) {
    if (!(currentMaterial instanceof SpriteMaterial)) continue;
    currentMaterial.map?.dispose();
    currentMaterial.dispose();
  }
}

/**
 * Dispose textures assigned to shader uniforms when present.
 *
 * @param material - Material to inspect for custom uniforms.
 */
const disposeMaterialUniformTextures = (material: Material): void => {
  if (!("uniforms" in material)) return;

  const shaderMaterial = material as Material & {
    uniforms?: Record<string, { value?: unknown }>;
  };
  const uniforms = shaderMaterial.uniforms;
  if (!uniforms) return;

  for (const uniform of Object.values(uniforms)) {
    const value = uniform?.value;

    if (value instanceof Texture) {
      value.dispose();
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item instanceof Texture) {
          item.dispose();
        }
      }
    }
  }
};

/**
 * Dispose one or many materials and any texture uniforms they own.
 *
 * @param material - Material value from a renderable object.
 */
const disposeMaterial = (material: Material | Material[]): void => {
  const materials = Array.isArray(material) ? material : [material];

  for (const currentMaterial of materials) {
    disposeMaterialUniformTextures(currentMaterial);
    currentMaterial.dispose();
  }
};

/**
 * Dispose all GPU-backed resources owned by scene children.
 *
 * @param scene - Scene whose descendants should be disposed.
 */
const disposeSceneChildren = (scene: Scene): void => {
  scene.traverse((object) => {
    const renderable = object as {
      geometry?: unknown;
      material?: Material | Material[];
    };

    if (isDisposable(renderable.geometry)) {
      renderable.geometry.dispose();
    }

    if (renderable.material) {
      disposeMaterial(renderable.material);
    }
  });

  while (scene.children.length > 0) {
    scene.remove(scene.children[0]);
  }
};

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
 * @param options - Optional configuration for camera and initial position
 * @returns An object containing the `scene`, `camera`, `renderer`, and
 * a `resizeHandler` and `disposeScene` function for deterministic cleanup.
 */
export const setupScene = (
  mount: HTMLDivElement | null,
  options: SceneOptions = {},
): {
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  resizeHandler: () => void;
  disposeScene: () => void;
} => {
  const { cameraConfig = {}, cameraPosition = {} } = options;

  const {
    fov = ORBIT_CAM_FOV,
    aspect = 16 / 9,
    near = ORBIT_CAM_NEAR,
    far = ORBIT_CAM_FAR,
  } = cameraConfig;
  const { x = 0, y = 100, z = 5 } = cameraPosition;
  if (!mount) throw new Error("Mount element not ready");

  // Scene + background
  const scene = new Scene();

  // Add Sky
  const sky = new Sky();
  sky.scale.setScalar(450000);
  scene.add(sky);

  const sun = new Vector3();

  const skyUniforms = sky.material.uniforms;
  skyUniforms["turbidity"].value = 2;
  skyUniforms["rayleigh"].value = 1;
  skyUniforms["mieCoefficient"].value = 0.005;
  skyUniforms["mieDirectionalG"].value = 0.8;

  const elevation = 60;
  const azimuth = 180;

  const phi = MathUtils.degToRad(90 - elevation);
  const theta = MathUtils.degToRad(azimuth);
  sun.setFromSphericalCoords(1, phi, theta);

  sky.material.uniforms["sunPosition"].value.copy(sun);

  // Camera setup using mount dimensions when available
  const camera = new PerspectiveCamera(
    fov,
    mount.clientWidth / mount.clientHeight || aspect,
    near,
    far,
  );
  camera.position.set(x, y, z);
  camera.lookAt(0, 0, 0);

  // Simple lighting for basic visibility
  const ambient = new AmbientLight(0xffffff, 0.6);
  scene.add(ambient);
  const dir = new DirectionalLight(0xffffff, 0.6);
  dir.position.set(10, 10, 10);
  scene.add(dir);

  // Renderer + DOM attachment
  const renderer = new WebGLRenderer({
    antialias: true,
    logarithmicDepthBuffer: true,
    powerPreference: "high-performance",
    preserveDrawingBuffer: true,
  });
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

  const disposeScene = () => {
    disposeSceneChildren(scene);
  };

  return { scene, camera, renderer, resizeHandler, disposeScene };
};
