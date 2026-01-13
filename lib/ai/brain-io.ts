import type { NeuralNetworkJson } from "@/lib/ai/network";

/**
 * Stable, user-facing file format for exporting/importing a trained brain.
 *
 * NOTE: Keep this backwards compatible if you ever change it. The app can
 * still accept a raw `NeuralNetworkJson` for convenience.
 */
export type BrainFileJson = {
  schema: "avs-peg/brain";
  version: 1;
  brain: NeuralNetworkJson;
  meta?: {
    /** Unix timestamp (ms) when exported */
    exportedAt?: number;
    /** Fitness score of the exporting agent (if known) */
    fitness?: number;
    /** Training generation number (if known) */
    generation?: number;
    /** Free-form note */
    note?: string;
  };
};

export type BrainImportResult =
  | { ok: true; brain: NeuralNetworkJson }
  | { ok: false; error: string };

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function isNumberArray(a: unknown, expectedLength?: number): a is number[] {
  if (!Array.isArray(a)) return false;
  if (expectedLength !== undefined && a.length !== expectedLength) return false;
  return a.every(isFiniteNumber);
}

function isNumberMatrix(
  m: unknown,
  expectedRows?: number,
  expectedCols?: number,
): m is number[][] {
  if (!Array.isArray(m)) return false;
  if (expectedRows !== undefined && m.length !== expectedRows) return false;
  for (const row of m) {
    if (!isNumberArray(row, expectedCols)) return false;
  }
  return true;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === "object" && v !== null;
}

function getProp(obj: UnknownRecord, key: string): unknown {
  return obj[key];
}

export function validateNeuralNetworkJson(
  json: unknown,
  opts?: {
    expectedInputCount?: number;
    expectedOutputCount?: number;
  },
): BrainImportResult {
  if (!isRecord(json)) {
    return { ok: false, error: "Brain JSON must be an object." };
  }

  const levelsUnknown = getProp(json, "levels");
  if (!Array.isArray(levelsUnknown) || levelsUnknown.length === 0) {
    return {
      ok: false,
      error: "Brain JSON must contain a non-empty levels array.",
    };
  }

  const levels = levelsUnknown;

  for (let i = 0; i < levels.length; i++) {
    const lvlUnknown = levels[i];
    if (!isRecord(lvlUnknown)) {
      return { ok: false, error: `Level ${i} must be an object.` };
    }

    const inputCount = getProp(lvlUnknown, "inputCount");
    const outputCount = getProp(lvlUnknown, "outputCount");
    const biases = getProp(lvlUnknown, "biases");
    const weights = getProp(lvlUnknown, "weights");

    if (!Number.isInteger(inputCount) || inputCount <= 0) {
      return {
        ok: false,
        error: `Level ${i} inputCount must be a positive integer.`,
      };
    }
    if (!Number.isInteger(outputCount) || outputCount <= 0) {
      return {
        ok: false,
        error: `Level ${i} outputCount must be a positive integer.`,
      };
    }

    if (!isNumberArray(biases, outputCount)) {
      return {
        ok: false,
        error: `Level ${i} biases must be a number[] of length ${outputCount}.`,
      };
    }

    if (!isNumberMatrix(weights, inputCount, outputCount)) {
      return {
        ok: false,
        error: `Level ${i} weights must be number[${inputCount}][${outputCount}].`,
      };
    }

    // Connectivity sanity check across levels
    if (i > 0) {
      const prevLvl = levels[i - 1];
      if (!isRecord(prevLvl)) {
        return { ok: false, error: `Level ${i - 1} must be an object.` };
      }
      const prevOut = getProp(prevLvl, "outputCount");
      if (!Number.isInteger(prevOut)) {
        return {
          ok: false,
          error: `Level ${i - 1} outputCount must be an integer.`,
        };
      }
      if (prevOut !== inputCount) {
        return {
          ok: false,
          error: `Incompatible architecture: level ${i - 1} outputCount (${prevOut}) != level ${i} inputCount (${inputCount}).`,
        };
      }
    }
  }

  const first = levels[0];
  const last = levels[levels.length - 1];
  if (!isRecord(first) || !isRecord(last)) {
    return { ok: false, error: "Invalid levels array." };
  }

  const inputCount = getProp(first, "inputCount");
  const outputCount = getProp(last, "outputCount");
  if (!Number.isInteger(inputCount) || !Number.isInteger(outputCount)) {
    return { ok: false, error: "Invalid level input/output counts." };
  }

  if (
    opts?.expectedInputCount !== undefined &&
    inputCount !== opts.expectedInputCount
  ) {
    return {
      ok: false,
      error: `Brain expects ${inputCount} inputs but this mode expects ${opts.expectedInputCount}.`,
    };
  }
  if (
    opts?.expectedOutputCount !== undefined &&
    outputCount !== opts.expectedOutputCount
  ) {
    return {
      ok: false,
      error: `Brain outputs ${outputCount} values but this mode expects ${opts.expectedOutputCount}.`,
    };
  }

  return { ok: true, brain: json as NeuralNetworkJson };
}

/**
 * Accepts either our wrapped `BrainFileJson` or a raw `NeuralNetworkJson`.
 */
export function importBrainJson(
  json: unknown,
  opts?: {
    expectedInputCount?: number;
    expectedOutputCount?: number;
  },
): BrainImportResult {
  if (isRecord(json)) {
    const schema = getProp(json, "schema");
    const version = getProp(json, "version");

    if (schema === "avs-peg/brain") {
      if (version !== 1) {
        return {
          ok: false,
          error: `Unsupported brain file version: ${String(version)}`,
        };
      }
      return validateNeuralNetworkJson(getProp(json, "brain"), opts);
    }
  }

  return validateNeuralNetworkJson(json, opts);
}

export function exportBrainJson(params: {
  brain: NeuralNetworkJson;
  fitness?: number;
  generation?: number;
  note?: string;
}): BrainFileJson {
  return {
    schema: "avs-peg/brain",
    version: 1,
    brain: params.brain,
    meta: {
      exportedAt: Date.now(),
      fitness: params.fitness,
      generation: params.generation,
      note: params.note,
    },
  };
}
