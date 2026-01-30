import {
  CarStatePayload,
  CarWorkerInboundMessage,
  WorkerCarState,
  WorkerInboundMessageType,
  WorkerOutboundMessageType,
} from "@/lib/car/types";

// ─────────────────────────────────────────────────────────────────────────────
// Worker State
// ─────────────────────────────────────────────────────────────────────────────

let carState: WorkerCarState;

// ─────────────────────────────────────────────────────────────────────────────
// Message Handler
// ─────────────────────────────────────────────────────────────────────────────

onmessage = (event: MessageEvent<CarWorkerInboundMessage>) => {
  const message = event.data;

  switch (message.type) {
    case WorkerInboundMessageType.INIT:
      carState = message.payload;
      startAnimationLoop();
      break;

    case WorkerInboundMessageType.UPDATE_CONTROLS:
      if (carState.id === message.payload.id) {
        carState.controls = message.payload.controls;
      }
      break;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Animation Loop
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Start the animation loop for continuous physics updates.
 */
const startAnimationLoop = () => {
  requestAnimationFrame(startAnimationLoop);
  updateAndBroadcastState();
};

/**
 * Process physics update and broadcast new state to main thread.
 */
const updateAndBroadcastState = () => {
  applyPhysicsStep();

  self.postMessage({
    type: WorkerOutboundMessageType.STATE_UPDATE,
    payload: {
      id: carState.id,
      position: carState.position,
      angle: carState.angle,
      damaged: carState.damaged,
    } as CarStatePayload,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Physics Simulation
// ─────────────────────────────────────────────────────────────────────────────

/** Turn rate in radians per frame */
const TURN_RATE = 0.03;

/**
 * Apply a single timestep of vehicle dynamics.
 *
 * Applies acceleration/reverse inputs, clamps speed, applies friction,
 * handles turning (inverts when reversing) and updates position.
 */
const applyPhysicsStep = () => {
  applyAcceleration();
  clampSpeed();
  applyFriction();
  applySteering();
  updatePosition();
};

/** Apply forward/reverse acceleration based on control inputs */
const applyAcceleration = () => {
  if (carState.controls.forward) {
    carState.speed += carState.acceleration;
  }
  if (carState.controls.reverse) {
    carState.speed -= carState.acceleration;
  }
};

/** Clamp speed to max forward speed and half max reverse speed */
const clampSpeed = () => {
  const maxReverseSpeed = -carState.maxSpeed / 2;

  if (carState.speed > carState.maxSpeed) {
    carState.speed = carState.maxSpeed;
  }
  if (carState.speed < maxReverseSpeed) {
    carState.speed = maxReverseSpeed;
  }
};

/** Apply friction to gradually reduce speed */
const applyFriction = () => {
  if (carState.speed > 0) {
    carState.speed -= carState.friction;
  }
  if (carState.speed < 0) {
    carState.speed += carState.friction;
  }

  // Stop completely if speed is below friction threshold
  if (Math.abs(carState.speed) < carState.friction) {
    carState.speed = 0;
  }
};

/** Apply steering based on control inputs (inverts when reversing) */
const applySteering = () => {
  if (carState.speed === 0) return;

  // Flip steering direction when reversing
  const steeringDirection = carState.speed > 0 ? 1 : -1;

  // In math, counter-clockwise is positive angle
  if (carState.controls.left) {
    carState.angle -= TURN_RATE * steeringDirection;
  }
  if (carState.controls.right) {
    carState.angle += TURN_RATE * steeringDirection;
  }
};

/** Update position based on current speed and heading angle */
const updatePosition = () => {
  carState.position.x += Math.cos(carState.angle) * carState.speed;
  carState.position.y += Math.sin(carState.angle) * carState.speed;
};
