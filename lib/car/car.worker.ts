/// <reference lib="webworker" />

import { NeuralNetwork } from "@/lib/ai/network";
import { ControlType } from "@/lib/car/controls";
import { getIntersection, lerp } from "@/utils/math";
import { Node } from "@/lib/primitives/node";
import type {
  CarInitDto,
  CarStateDto,
  CarTickDto,
  CarWorkerInboundMessage,
  CarWorkerOutboundMessage,
  ControlsDto,
  RayDto,
  TrafficCarDto,
} from "@/lib/car/worker-protocol";

import type { NodeJson } from "@/types/save";

function toNode(p: NodeJson): Node {
  return new Node(p.x, p.y);
}

function createCarPolygon(
  position: NodeJson,
  breadth: number,
  length: number,
  angle: number,
): NodeJson[] {
  const rad = Math.hypot(breadth, length) / 2;
  const alpha = Math.atan2(breadth, length);

  return [
    {
      x: position.x - Math.sin(angle - alpha) * rad,
      y: position.y - Math.cos(angle - alpha) * rad,
    },
    {
      x: position.x - Math.sin(angle + alpha) * rad,
      y: position.y - Math.cos(angle + alpha) * rad,
    },
    {
      x: position.x - Math.sin(Math.PI + angle - alpha) * rad,
      y: position.y - Math.cos(Math.PI + angle - alpha) * rad,
    },
    {
      x: position.x - Math.sin(Math.PI + angle + alpha) * rad,
      y: position.y - Math.cos(Math.PI + angle + alpha) * rad,
    },
  ];
}

function defaultControls(): ControlsDto {
  return { forward: false, left: false, right: false, reverse: false };
}

function castRays(
  carPos: NodeJson,
  carAngle: number,
  rayCount: number,
  rayLength: number,
  raySpreadAngle: number,
): RayDto[] {
  const rays: RayDto[] = [];
  for (let i = 0; i < rayCount; i++) {
    const rayAngle =
      lerp(
        raySpreadAngle / 2,
        -raySpreadAngle / 2,
        rayCount === 1 ? 0.5 : i / (rayCount - 1),
      ) - carAngle;

    const start = { x: carPos.x, y: carPos.y };
    const end = {
      x: carPos.x + Math.sin(rayAngle) * rayLength,
      y: carPos.y - Math.cos(rayAngle) * rayLength,
    };

    rays.push({ start, end });
  }
  return rays;
}

function getReading(
  ray: RayDto,
  traffic: TrafficCarDto[],
): { x: number; y: number; offset: number } | null {
  const touches: { x: number; y: number; offset: number }[] = [];

  for (const car of traffic) {
    const poly = car.polygon;
    if (!poly || poly.length < 2) continue;

    for (let j = 0; j < poly.length; j++) {
      const value = getIntersection(
        toNode(ray.start),
        toNode(ray.end),
        toNode(poly[j]),
        toNode(poly[(j + 1) % poly.length]),
      );
      if (value) touches.push(value);
    }
  }

  if (touches.length === 0) return null;

  let minOffset = Infinity;
  let best: { x: number; y: number; offset: number } | null = null;
  for (const t of touches) {
    if (t.offset < minOffset) {
      minOffset = t.offset;
      best = t;
    }
  }

  return best;
}

function assessDamage(selfPoly: NodeJson[], traffic: TrafficCarDto[]): boolean {
  for (const car of traffic) {
    const other = car.polygon;
    if (!other || other.length < 3) continue;

    for (let i = 0; i < selfPoly.length; i++) {
      const a1 = selfPoly[i];
      const a2 = selfPoly[(i + 1) % selfPoly.length];
      for (let j = 0; j < other.length; j++) {
        const b1 = other[j];
        const b2 = other[(j + 1) % other.length];
        if (getIntersection(toNode(a1), toNode(a2), toNode(b1), toNode(b2))) {
          return true;
        }
      }
    }
  }
  return false;
}

type WorkerState = {
  init: CarInitDto;
  position: NodeJson;
  angle: number;
  speed: number;
  damaged: boolean;
  controls: ControlsDto;
  brain: NeuralNetwork | null;
};

let state: WorkerState | null = null;

function post(msg: CarWorkerOutboundMessage) {
  self.postMessage(msg);
}

function moveCar(s: WorkerState) {
  const { acceleration, friction, maxSpeed } = s.init;
  const c = s.controls;

  if (c.forward) s.speed += acceleration;
  if (c.reverse) s.speed -= acceleration;

  if (s.speed > maxSpeed) s.speed = maxSpeed;
  if (s.speed < -maxSpeed / 2) s.speed = -maxSpeed / 2;

  if (s.speed > 0) s.speed -= friction;
  if (s.speed < 0) s.speed += friction;

  if (Math.abs(s.speed) < friction) s.speed = 0;

  if (s.speed !== 0) {
    const flip = s.speed > 0 ? 1 : -1;
    if (c.left) s.angle += 0.03 * flip;
    if (c.right) s.angle -= 0.03 * flip;
  }

  s.position = {
    x: s.position.x - Math.sin(s.angle) * s.speed,
    y: s.position.y - Math.cos(s.angle) * s.speed,
  };
}

function computeTick(tick: CarTickDto): CarStateDto {
  if (!state) throw new Error("Worker not initialized");

  const init = state.init;

  // Apply controls
  if (init.controlType === ControlType.HUMAN) {
    state.controls = tick.controls ?? defaultControls();
  } else if (init.controlType === ControlType.NONE) {
    state.controls = defaultControls();
  }

  // Sensors + AI decide (must happen before move to match existing logic)
  const rays = castRays(
    state.position,
    state.angle,
    init.rayCount,
    init.rayLength,
    init.raySpreadAngle,
  );

  const readings = rays.map((ray) => getReading(ray, tick.traffic));
  const offsets = readings.map((s) => (s == null ? 0 : 1 - s.offset));

  if (init.controlType === ControlType.AI && state.brain) {
    const outputs = state.brain.decide(offsets);
    state.controls = {
      forward: outputs[0] === 1,
      left: outputs[1] === 1,
      right: outputs[2] === 1,
      reverse: outputs[3] === 1,
    };
  }

  // Movement + collisions
  if (!state.damaged) {
    moveCar(state);
  }

  const polygon = createCarPolygon(
    state.position,
    init.breadth,
    init.length,
    state.angle,
  );
  if (!state.damaged) {
    state.damaged = assessDamage(polygon, tick.traffic);
  }

  return {
    id: init.id,
    position: { x: state.position.x, y: state.position.y },
    angle: state.angle,
    speed: state.speed,
    damaged: state.damaged,
    polygon,
    controls: { ...state.controls },
    sensor: {
      rays,
      readings,
    },
  };
}

self.onmessage = (event: MessageEvent<CarWorkerInboundMessage>) => {
  const msg = event.data;

  switch (msg.type) {
    case "init": {
      const init: CarInitDto = msg.init;
      state = {
        init,
        position: { ...init.position },
        angle: init.angle,
        speed: 0,
        damaged: false,
        controls:
          init.controlType === ControlType.AI
            ? { forward: true, left: false, right: false, reverse: false }
            : defaultControls(),
        brain:
          init.controlType === ControlType.AI
            ? new NeuralNetwork([init.rayCount, 6, 4])
            : null,
      };
      post({ type: "ready", id: init.id });
      return;
    }

    case "tick": {
      if (!state) return;
      const newState = computeTick(msg.tick);
      post({ type: "state", state: newState });
      return;
    }
  }
};
