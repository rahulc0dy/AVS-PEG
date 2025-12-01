import { MINIVIEW_HEIGHT, MINIVIEW_WIDTH, MINIVIEW_X, MINIVIEW_Y } from "@/env";

export function MiniMapOverlay() {
  return (
    <div
      className="pointer-events-none fixed bottom-4 left-4 z-10 border border-gray-200"
      style={{
        left: MINIVIEW_X,
        bottom: MINIVIEW_Y,
        width: MINIVIEW_WIDTH,
        height: MINIVIEW_HEIGHT,
      }}
    />
  );
}
