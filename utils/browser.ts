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

export function downloadTextFile(params: {
  filename: string;
  content: string;
  mimeType?: string;
}): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const blob = new Blob([params.content], {
    type: params.mimeType ?? "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = params.filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

export async function pickAndReadJsonFile(): Promise<
  { ok: true; json: unknown; filename?: string } | { ok: false; error: string }
> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return {
      ok: false,
      error: "File picker is not available in this environment.",
    };
  }

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve({ ok: false, error: "No file selected." });
        return;
      }

      try {
        const text = await file.text();
        const json = JSON.parse(text) as unknown;
        resolve({ ok: true, json, filename: file.name });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        resolve({ ok: false, error: `Failed to read JSON: ${message}` });
      }
    };

    input.onerror = () => {
      resolve({ ok: false, error: "Failed to open file picker." });
    };

    input.click();
  });
}
