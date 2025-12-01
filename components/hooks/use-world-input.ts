import { useCallback, useRef } from "react";
import { Camera, Plane, Raycaster, Vector2, Vector3 } from "three";

/**
 * Hook that manages pointer-to-world conversion for the given camera and DOM element.
 *
 * The hook maintains an internal `Raycaster` and normalized pointer coordinates
 * and exposes two functions: `updatePointer` (to update the ray from a PointerEvent)
 * and `getIntersectPoint` (to get the intersection with a ground plane at y=0).
 *
 * @param {Camera} camera - Three.js camera used for raycasting.
 * @param {HTMLElement} dom - DOM element used to compute pointer coordinates relative to the canvas.
 * @returns {{
 *   updatePointer: (evt: PointerEvent) => void,
 *   getIntersectPoint: () => Vector3
 * }} An object with functions to update pointer state and get the current ground intersection point.
 */
export function useWorldInput(camera: Camera, dom: HTMLElement) {
  const raycasterRef = useRef(new Raycaster());
  // `pointerRef` stores normalized device coordinates (NDC) for the pointer
  // so we can reuse the value for raycasting without recreating objects.
  const pointerRef = useRef(new Vector2());

  const updatePointer = useCallback(
    (evt: PointerEvent) => {
      const rect = dom.getBoundingClientRect();
      pointerRef.current.x = ((evt.clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y = -((evt.clientY - rect.top) / rect.height) * 2 + 1;
      // Update the raycaster using normalized device coordinates (NDC).
      raycasterRef.current.setFromCamera(pointerRef.current, camera);
    },
    [camera, dom],
  );

  const getIntersectPoint = useCallback((): Vector3 => {
    const raycaster = raycasterRef.current;
    // Intersect the ray with a horizontal plane (y=0) to get the world-space
    // point under the pointer. This is a common way to project screen input
    // into a 3D ground plane.
    const intersectingPlaneNormal = new Vector3(0, 1, 0);
    const plane = new Plane(intersectingPlaneNormal);
    const intersectPoint = new Vector3();
    raycaster.ray.intersectPlane(plane, intersectPoint);
    return intersectPoint;
  }, []);

  return { updatePointer, getIntersectPoint };
}
