import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const OUTPUT_DIR = path.join(process.cwd(), "public", "debug-snapshots");

/**
 * POST /api/debug-snapshot
 *
 * Accepts a raw PNG blob and writes it to `public/debug-snapshots/`.
 * For development / testing only.
 */
export async function POST(req: NextRequest) {
  try {
    await mkdir(OUTPUT_DIR, { recursive: true });

    const blob = await req.blob();
    const buffer = Buffer.from(await blob.arrayBuffer());
    const filename = `snapshot-${Date.now()}.png`;
    const filepath = path.join(OUTPUT_DIR, filename);

    await writeFile(filepath, buffer);

    return NextResponse.json({ ok: true, filename, filepath });
  } catch (err) {
    console.error("Failed to save debug snapshot:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 },
    );
  }
}
