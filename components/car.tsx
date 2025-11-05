"use client";

import { useEffect, useRef, useState } from "react";
import {
  Scene,
  Object3D,
  Box3,
  Vector3,
  Clock,
  Raycaster,
  Group,
  Line,
  LineBasicMaterial,
  BufferGeometry,
  BufferAttribute,
  MathUtils,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { useKeyboardControls } from "@/hooks/useKeyboardControls";

type CarProps = {
  modelPath: string;
  scene: Scene | null;
};

const Car = ({ modelPath, scene }: CarProps) => {
  const keyboardControls = useKeyboardControls();
  const [model, setModel] = useState<Object3D | null>(null);
  const [speed, setSpeed] = useState(5);
  const [turnSpeed, setTurnSpeed] = useState(1.5);
  const [rayCount, setRayCount] = useState(12);
  const [rayLength, setRayLength] = useState(15);
  const [coverageAngle, setCoverageAngle] = useState(360);
  const [rayHeightOffset, setRayHeightOffset] = useState(1);
  const [rayOriginRadius, setRayOriginRadius] = useState(0);

  const clockRef = useRef(new Clock());
  const raycasterRef = useRef(new Raycaster());
  const rayGroupRef = useRef<Group | null>(null);
  const rayLinesRef = useRef<Line[]>([]);
  const carSizeRef = useRef(new Vector3(1, 1, 1));
  const ignoredUUIDsRef = useRef<Set<string>>(new Set());
  const rayUUIDsRef = useRef<Set<string>>(new Set());
  const tempVecRef = useRef({
    forward: new Vector3(),
    right: new Vector3(),
    up: new Vector3(),
    carPosition: new Vector3(),
  });

  useEffect(() => {
    if (!scene || !modelPath) return;

    const loader = new GLTFLoader();
    let currentModel: Object3D | null = null;

    const onError = (error: unknown) => {
      console.error(`Error loading model "${modelPath}":`, error);
    };

    loader.load(
      modelPath,
      (gltf) => {
        if (!scene) return;
        currentModel = gltf.scene;
        scene.add(gltf.scene);
        setModel(gltf.scene);
      },
      undefined,
      onError
    );

    return () => {
      if (currentModel && scene) {
        scene.remove(currentModel);
      }
      setModel(null);
      currentModel = null;
    };
  }, [modelPath, scene]);

  useEffect(() => {
    if (!model) return;

    const bbox = new Box3().setFromObject(model);
    const size = new Vector3();
    bbox.getSize(size);
    if (size.lengthSq() === 0) {
      size.set(1, 1, 1);
    }
    carSizeRef.current.copy(size);

    const uuidSet = new Set<string>();
    model.traverse((child: Object3D) => {
      uuidSet.add(child.uuid);
    });
    ignoredUUIDsRef.current = uuidSet;
    return () => {
      ignoredUUIDsRef.current = new Set<string>();
    };
  }, [model]);

  useEffect(() => {
    if (!scene) return;

    const group = new Group();
    group.name = "car-raycasts";
    scene.add(group);
    rayGroupRef.current = group;

    return () => {
      scene.remove(group);
      rayLinesRef.current.forEach((line) => {
        line.geometry.dispose();
        (line.material as LineBasicMaterial).dispose();
      });
      rayLinesRef.current = [];
      rayGroupRef.current = null;
      rayUUIDsRef.current = new Set<string>();
    };
  }, [scene]);

  useEffect(() => {
    const group = rayGroupRef.current;
    if (!group) return;

    rayLinesRef.current.forEach((line) => {
      group.remove(line);
      line.geometry.dispose();
      (line.material as LineBasicMaterial).dispose();
    });

    const newLines: Line[] = [];
    for (let i = 0; i < rayCount; i += 1) {
      const geometry = new BufferGeometry();
      const positions = new Float32Array(6);
      geometry.setAttribute("position", new BufferAttribute(positions, 3));
      const material = new LineBasicMaterial({ color: 0x00ff88 });
      const line = new Line(geometry, material);
      line.frustumCulled = false;
      group.add(line);
      newLines.push(line);
    }

    rayLinesRef.current = newLines;

    const uuidSet = new Set<string>();
    group.traverse((child: Object3D) => {
      uuidSet.add(child.uuid);
    });
    rayUUIDsRef.current = uuidSet;
  }, [rayCount, scene]);

  useEffect(() => {
    if (!model) return;

    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clockRef.current.getDelta();

      const { forward, backward, left, right } = keyboardControls.current;

      if (forward) model.translateZ(speed * delta);
      if (backward) model.translateZ(-speed * delta);
      if (left) model.rotateY(turnSpeed * delta);
      if (right) model.rotateY(-turnSpeed * delta);

      if (!scene || !rayLinesRef.current.length) {
        return;
      }

      const {
        forward: forwardVec,
        right: rightVec,
        up: upVec,
        carPosition,
      } = tempVecRef.current;

      forwardVec.set(0, 0, -1).applyQuaternion(model.quaternion).normalize();
      rightVec.set(1, 0, 0).applyQuaternion(model.quaternion).normalize();
      upVec.set(0, 1, 0).applyQuaternion(model.quaternion).normalize();
      model.getWorldPosition(carPosition);

      const heightOffsetVec = upVec.clone().multiplyScalar(rayHeightOffset);
      const candidates = scene.children;
      const raycaster = raycasterRef.current;
      const totalAngleDeg = Math.min(Math.max(coverageAngle, 0), 360);
      const totalAngleRad = MathUtils.degToRad(totalAngleDeg);
      const fullCircle = totalAngleDeg >= 360;
      const denominator = fullCircle
        ? Math.max(rayCount, 1)
        : Math.max(rayCount - 1, 1);
      const angleStart = fullCircle ? 0 : -totalAngleRad / 2;
      const baseRadius =
        Math.max(carSizeRef.current.x, carSizeRef.current.z) * 0.5 +
        rayOriginRadius;

      rayLinesRef.current.forEach((line, index) => {
        const normalizedIndex = rayCount === 1 ? 0 : index / denominator;
        const angle = angleStart + normalizedIndex * totalAngleRad;
        const cosAngle = Math.cos(angle);
        const sinAngle = Math.sin(angle);

        const radialDirection = forwardVec
          .clone()
          .multiplyScalar(cosAngle)
          .add(rightVec.clone().multiplyScalar(sinAngle))
          .normalize();

        const origin = carPosition
          .clone()
          .add(radialDirection.clone().multiplyScalar(baseRadius))
          .add(heightOffsetVec);

        const direction = radialDirection.clone();

        raycaster.set(origin, direction);
        raycaster.far = rayLength;

        const intersections = raycaster.intersectObjects(candidates, true);

        let hitPoint = origin
          .clone()
          .add(direction.clone().multiplyScalar(rayLength));
        let detected = false;

        for (const intersection of intersections) {
          if (ignoredUUIDsRef.current.has(intersection.object.uuid)) continue;
          if (rayUUIDsRef.current.has(intersection.object.uuid)) continue;
          hitPoint.copy(intersection.point);
          detected = true;
          break;
        }

        const positions = line.geometry.getAttribute(
          "position"
        ) as BufferAttribute;
        positions.setXYZ(0, origin.x, origin.y, origin.z);
        positions.setXYZ(1, hitPoint.x, hitPoint.y, hitPoint.z);
        positions.needsUpdate = true;

        const material = line.material as LineBasicMaterial;
        material.color.setHex(detected ? 0xff4444 : 0x00ff88);
      });
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [
    model,
    scene,
    keyboardControls,
    speed,
    turnSpeed,
    rayCount,
    rayLength,
    coverageAngle,
    rayHeightOffset,
    rayOriginRadius,
  ]);

  return (
    <div className="absolute top-4 left-4 bg-black/70 p-4 rounded-lg text-white space-y-4 w-72">
      <div>
        <label className="block text-sm font-semibold mb-2">
          Movement Speed: {speed.toFixed(1)}
        </label>
        <input
          type="range"
          min="0"
          max="20"
          step="0.5"
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
          className="w-full"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold mb-2">
          Turn Speed: {turnSpeed.toFixed(2)}
        </label>
        <input
          type="range"
          min="0"
          max="5"
          step="0.1"
          value={turnSpeed}
          onChange={(e) => setTurnSpeed(parseFloat(e.target.value))}
          className="w-full"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold mb-2">
          Ray Count: {rayCount}
        </label>
        <input
          type="range"
          min="1"
          max="15"
          step="1"
          value={rayCount}
          onChange={(e) => setRayCount(parseInt(e.target.value, 10))}
          className="w-full"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold mb-2">
          Ray Length: {rayLength.toFixed(1)}
        </label>
        <input
          type="range"
          min="1"
          max="50"
          step="0.5"
          value={rayLength}
          onChange={(e) => setRayLength(parseFloat(e.target.value))}
          className="w-full"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold mb-2">
          Coverage Angle: {coverageAngle.toFixed(0)}°
        </label>
        <input
          type="range"
          min="0"
          max="360"
          step="5"
          value={coverageAngle}
          onChange={(e) => setCoverageAngle(parseFloat(e.target.value))}
          className="w-full"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold mb-2">
          Ray Origin Offset: {rayOriginRadius.toFixed(2)}
        </label>
        <input
          type="range"
          min="0"
          max="5"
          step="0.1"
          value={rayOriginRadius}
          onChange={(e) => setRayOriginRadius(parseFloat(e.target.value))}
          className="w-full"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold mb-2">
          Ray Height Offset: {rayHeightOffset.toFixed(2)}
        </label>
        <input
          type="range"
          min="-2"
          max="4"
          step="0.1"
          value={rayHeightOffset}
          onChange={(e) => setRayHeightOffset(parseFloat(e.target.value))}
          className="w-full"
        />
      </div>
    </div>
  );
};

export default Car;
