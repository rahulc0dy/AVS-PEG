import { MINIVIEW_HEIGHT, MINIVIEW_WIDTH, MINIVIEW_X, MINIVIEW_Y } from "@/env";

/**
 * Visual placeholder/overlay for the mini-map view.
 *
 * Uses layout constants from `@/env` to position and size the overlay.
 * This element is pointer-events-none so it does not block user interaction
 * with the main canvas behind it.
 *
 * @returns {JSX.Element} A positioned div that acts as the mini-map container.
 */
export function MiniMapOverlay() {
  return (
    <div
      className="pointer-events-none fixed bottom-4 left-4 z-10 border border-zinc-700 rounded-sm"
      style={{
        left: MINIVIEW_X,
        bottom: MINIVIEW_Y,
        width: MINIVIEW_WIDTH,
        height: MINIVIEW_HEIGHT,
      }}
    />
  );
}
