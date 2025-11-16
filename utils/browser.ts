// utils/browser.ts

/**
 * Returns true if the current environment can use WebGPU.
 * Checks for secure context, presence of navigator.gpu, and a usable adapter.
 */
export function isWebGPUSupported(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined")
    return false;
  if (!window.isSecureContext) return false;

  const nav: Navigator = navigator;
  if (!nav?.gpu) return false;

  return true;
}
