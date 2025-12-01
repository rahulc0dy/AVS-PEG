import { useCallback, useRef } from "react";
import { Camera, Plane, Raycaster, Vector2, Vector3 } from "three";

export function useWorldInput(camera: Camera, dom: HTMLElement) {
  const raycasterRef = useRef(new Raycaster());
  const pointerRef = useRef(new Vector2());

  const updatePointer = useCallback(
    (evt: PointerEvent) => {
      const rect = dom.getBoundingClientRect();
      pointerRef.current.x = ((evt.clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y = -((evt.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(pointerRef.current, camera);
    },
    [camera, dom],
  );

  const getIntersectPoint = useCallback((): Vector3 => {
    const raycaster = raycasterRef.current;
    const intersectingPlaneNormal = new Vector3(0, 1, 0);
    const plane = new Plane(intersectingPlaneNormal);
    const intersectPoint = new Vector3();
    raycaster.ray.intersectPlane(plane, intersectPoint);
    return intersectPoint;
  }, []);

  return { updatePointer, getIntersectPoint };
}
