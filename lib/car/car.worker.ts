/// <reference lib="webworker" />

import {
  CarControlSnapshot,
  CarKinematicsState,
  CarKinematicsStepResult,
  CarWorkerIncomingMessage,
  CarWorkerOutgoingMessage,
  CarWorkerStepResult,
} from "./car-worker-types";

const ctx: DedicatedWorkerGlobalScope =
  self as unknown as DedicatedWorkerGlobalScope;

let currentState: CarKinematicsState | null = null;
let carId: number | null = null;

ctx.onmessage = (event: MessageEvent<CarWorkerIncomingMessage>) => {
  const message = event.data;

  switch (message.type) {
    case "init": {
      carId = message.payload.id;
      currentState = message.payload.state;
      const ready: CarWorkerOutgoingMessage = {
        type: "ready",
        payload: { id: carId },
      };
      ctx.postMessage(ready);
      break;
    }
    case "step": {
      const step = handleStep(message.payload.state, message.payload.controls);
      const payload: CarWorkerStepResult = {
        ...step,
        id: carId ?? message.payload.state.id,
      };
      const response: CarWorkerOutgoingMessage = {
        type: "step",
        payload,
      };
      ctx.postMessage(response);
      break;
    }
  }
};

/**
 * Advance the car state using the shared kinematics helper. The worker
 * maintains a cached `currentState` to support future stateful algorithms
 * (e.g., neural networks) without depending on the main thread.
 *
 * @param state - Current kinematic state to advance.
 * @param controls - Control snapshot for this step.
 * @returns Worker step result containing updated state and footprint.
 */
function handleStep(
  state: CarKinematicsState,
  controls: CarControlSnapshot,
): CarWorkerStepResult {
  currentState = state;
  const next = stepKinematics(currentState, controls);
  currentState = next.state;
  return { ...next, id: carId ?? state.id };
}

/**
 * Advance the car state by one tick based on the provided controls. The
 * computation mirrors the on-main-thread fallback but is pure and
 * thread-safe so it can run inside a worker.
 */
function stepKinematics(
  state: CarKinematicsState,
  controls: CarControlSnapshot,
): CarKinematicsStepResult {
  let speed = state.speed;
  let angle = state.angle;

  if (controls.forward) speed += state.acceleration;
  if (controls.reverse) speed -= state.acceleration;

  if (speed > state.maxSpeed) speed = state.maxSpeed;
  if (speed < -state.maxSpeed / 2) speed = -state.maxSpeed / 2;

  if (speed > 0) speed -= state.friction;
  if (speed < 0) speed += state.friction;
  if (Math.abs(speed) < state.friction) speed = 0;

  if (speed !== 0) {
    const flip = speed > 0 ? 1 : -1;
    if (controls.left) angle -= 0.03 * flip;
    if (controls.right) angle += 0.03 * flip;
  }

  const position = {
    x: state.position.x + Math.cos(angle) * speed,
    y: state.position.y + Math.sin(angle) * speed,
  };

  return {
    state: {
      ...state,
      position,
      angle,
      speed,
    },
    polygonPoints: createFootprint(position, angle, state.breadth, state.length),
  };
}

/**
 * Build the rectangular footprint polygon for a car given its centre position,
 * heading, width and length.
 */
function createFootprint(
  position: { x: number; y: number },
  angle: number,
  breadth: number,
  length: number,
) {
  const points: { x: number; y: number }[] = [];
  const radius = Math.hypot(breadth, length) / 2;
  const alpha = Math.atan2(breadth, length);

  points.push({
    x: position.x + Math.cos(angle - alpha) * radius,
    y: position.y + Math.sin(angle - alpha) * radius,
  });
  points.push({
    x: position.x + Math.cos(angle + alpha) * radius,
    y: position.y + Math.sin(angle + alpha) * radius,
  });
  points.push({
    x: position.x + Math.cos(Math.PI + angle - alpha) * radius,
    y: position.y + Math.sin(Math.PI + angle - alpha) * radius,
  });
  points.push({
    x: position.x + Math.cos(Math.PI + angle + alpha) * radius,
    y: position.y + Math.sin(Math.PI + angle + alpha) * radius,
  });

  return points;
}
