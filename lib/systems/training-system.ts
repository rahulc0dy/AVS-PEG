import { Car } from "@/lib/car/car";
import { Edge } from "@/lib/primitives/edge";
import { Node } from "@/lib/primitives/node";
import { distance } from "@/utils/math";

/**
 * Progress data for a single car along the path.
 */
export interface CarProgress {
  /** The car's unique identifier. */
  carId: number;
  /** Index of the path segment (edge) the car is currently on. */
  segmentIndex: number;
  /** Offset within the current segment (0 = at n1, 1 = at n2). */
  segmentOffset: number;
  /** Total progress as a normalized value (0 = start, 1 = end of path). */
  totalProgress: number;
  /** Whether the car has reached the final destination. */
  reachedDestination: boolean;
  /** Whether the car is damaged (crashed). */
  isDamaged: boolean;
}

/**
 * Training statistics for the current generation.
 */
export interface TrainingStats {
  /** Current generation number. */
  generation: number;
  /** Total number of cars in training. */
  totalCars: number;
  /** Number of cars still active (not damaged). */
  activeCars: number;
  /** Number of cars that reached the destination. */
  reachedDestination: number;
  /** Best fitness score in current generation. */
  bestFitness: number;
  /** ID of the best performing car. */
  bestCarId: number | null;
  /** Whether training is currently active. */
  isTraining: boolean;
  /** Whether all cars have finished (damaged or reached destination). */
  generationComplete: boolean;
}

/**
 * System responsible for AI training, including:
 * - Tracking car progress along path segments
 * - Calculating fitness scores
 * - Determining the best car for brain saving
 * - Managing training generations
 *
 * The path is divided into segments (edges). At bends, segments are angled
 * to follow the road. Progress is calculated by projecting car positions
 * onto segments and measuring distance traveled along the path.
 *
 * @example
 * ```ts
 * const training = new TrainingSystem();
 * training.setPath(pathEdges);
 * training.startTraining(cars);
 *
 * // Each frame:
 * training.update(cars);
 * const stats = training.getStats();
 * const bestCar = training.getBestCar(cars);
 * ```
 */
export class TrainingSystem {
  /** The path edges (segments) in order from source to destination. */
  private path: Edge[] = [];

  /** Cumulative lengths at the end of each segment. */
  private cumulativeLengths: number[] = [];

  /** Total path length. */
  private totalPathLength: number = 0;

  /** Progress data for each car, keyed by car ID. */
  private progressMap: Map<number, CarProgress> = new Map();

  /** Current generation number. */
  private generation: number = 0;

  /** Whether training is currently active. */
  private isTraining: boolean = false;

  /** Distance threshold for considering a car "on" a segment. */
  private readonly proximityThreshold: number = 50;

  /** Distance threshold for reaching destination. */
  private readonly destinationThreshold: number = 30;

  /**
   * Set the path for progress tracking.
   *
   * Call this whenever the path changes (e.g., when source/destination
   * markings are updated or when loading a new world).
   *
   * @param pathEdges - Ordered array of edges from source to destination.
   *                    Each edge should be oriented so n1 -> n2 follows
   *                    the direction of travel.
   */
  setPath(pathEdges: Edge[]): void {
    this.path = pathEdges;
    this.progressMap.clear();

    // Precompute cumulative lengths for efficient progress calculation
    this.cumulativeLengths = [];
    let cumulative = 0;

    for (const edge of this.path) {
      cumulative += edge.length();
      this.cumulativeLengths.push(cumulative);
    }

    this.totalPathLength = cumulative;
  }

  /**
   * Get the current path.
   */
  getPath(): Edge[] {
    return this.path;
  }

  /**
   * Start a new training session.
   *
   * @param incrementGeneration - Whether to increment the generation counter.
   */
  startTraining(incrementGeneration: boolean = true): void {
    if (incrementGeneration) {
      this.generation++;
    }
    this.isTraining = true;
    this.progressMap.clear();
  }

  /**
   * Stop the current training session.
   */
  stopTraining(): void {
    this.isTraining = false;
  }

  /**
   * Reset training state completely.
   */
  reset(): void {
    this.generation = 0;
    this.isTraining = false;
    this.progressMap.clear();
  }

  /**
   * Get the current generation number.
   */
  getGeneration(): number {
    return this.generation;
  }

  /**
   * Check if training is currently active.
   */
  getIsTraining(): boolean {
    return this.isTraining;
  }

  /**
   * Update progress for all cars.
   *
   * Projects each car's position onto the path segments to determine
   * which segment it's on and how far along the path it has traveled.
   *
   * @param cars - Array of cars to track.
   */
  update(cars: Car[]): void {
    if (
      !this.isTraining ||
      this.path.length === 0 ||
      this.totalPathLength === 0
    ) {
      return;
    }

    for (const car of cars) {
      const progress = this.calculateCarProgress(car);
      this.progressMap.set(car.id, progress);
    }
  }

  /**
   * Get progress data for a specific car.
   *
   * @param carId - The car's unique identifier.
   * @returns Progress data, or undefined if not tracked.
   */
  getProgress(carId: number): CarProgress | undefined {
    return this.progressMap.get(carId);
  }

  /**
   * Get all tracked progress data.
   *
   * @returns Map of car ID to progress data.
   */
  getAllProgress(): Map<number, CarProgress> {
    return this.progressMap;
  }

  /**
   * Get comprehensive training statistics.
   *
   * @param cars - Array of cars being trained.
   * @returns Training statistics object.
   */
  getStats(cars: Car[]): TrainingStats {
    const activeCars = cars.filter((c) => !c.damaged).length;
    const reachedDestination = this.getDestinationCount();

    let bestFitness = 0;
    let bestCarId: number | null = null;

    for (const car of cars) {
      const fitness = this.getFitness(car.id);
      if (fitness > bestFitness) {
        bestFitness = fitness;
        bestCarId = car.id;
      }
    }

    const generationComplete =
      cars.length > 0 &&
      cars.every(
        (car) => car.damaged || this.getProgress(car.id)?.reachedDestination,
      );

    return {
      generation: this.generation,
      totalCars: cars.length,
      activeCars,
      reachedDestination,
      bestFitness,
      bestCarId,
      isTraining: this.isTraining,
      generationComplete,
    };
  }

  /**
   * Find the best car based on progress along the path.
   *
   * Cars are ranked by:
   * 1. Total progress (higher is better)
   * 2. Undamaged cars are preferred over damaged ones at similar progress
   *
   * @param cars - Array of cars to evaluate.
   * @returns The best car, or null if no cars are provided.
   */
  getBestCar(cars: Car[]): Car | null {
    if (cars.length === 0 || this.path.length === 0) {
      return null;
    }

    let bestCar: Car | null = null;
    let bestProgress: CarProgress | null = null;

    for (const car of cars) {
      const progress = this.progressMap.get(car.id);
      if (!progress) continue;

      if (!bestCar || !bestProgress) {
        bestCar = car;
        bestProgress = progress;
        continue;
      }

      if (this.isBetterProgress(progress, bestProgress)) {
        bestCar = car;
        bestProgress = progress;
      }
    }

    return bestCar;
  }

  /**
   * Get the fitness score for a car (normalized to 0-1 range).
   *
   * The fitness considers:
   * - Progress along the path (primary factor)
   * - Damage state (damaged cars get a penalty)
   * - Reaching destination (bonus)
   *
   * @param carId - The car's unique identifier.
   * @returns Fitness score (0-1), or 0 if car not found.
   */
  getFitness(carId: number): number {
    const progress = this.progressMap.get(carId);
    if (!progress) return 0;

    let fitness = progress.totalProgress;

    // Bonus for reaching destination
    if (progress.reachedDestination) {
      fitness = 1.0;
    }

    // Penalty for being damaged (but don't zero out progress)
    if (progress.isDamaged) {
      fitness *= 0.9;
    }

    return Math.min(1, Math.max(0, fitness));
  }

  /**
   * Get the number of cars that have reached the destination.
   *
   * @returns Count of cars at destination.
   */
  getDestinationCount(): number {
    let count = 0;
    for (const progress of this.progressMap.values()) {
      if (progress.reachedDestination) {
        count++;
      }
    }
    return count;
  }

  /**
   * Clear all tracked progress data (keeps generation and training state).
   */
  clearProgress(): void {
    this.progressMap.clear();
  }

  /**
   * Calculate progress for a single car by projecting its position
   * onto path segments.
   */
  private calculateCarProgress(car: Car): CarProgress {
    const pos = car.position;

    // Find the best matching segment
    let bestSegmentIndex = 0;
    let bestOffset = 0;
    let minDistance = Infinity;

    for (let i = 0; i < this.path.length; i++) {
      const edge = this.path[i];
      const projection = edge.projectNode(pos);

      // Clamp offset to [0, 1] for points beyond segment endpoints
      const clampedOffset = Math.max(0, Math.min(1, projection.offset));
      const clampedPoint = this.getPointOnEdge(edge, clampedOffset);
      const dist = distance(pos, clampedPoint);

      // Prefer segments where the car is actually on/near the segment
      // and prefer later segments if car is progressing forward
      if (dist < minDistance) {
        // Check if within proximity threshold
        if (dist <= this.proximityThreshold) {
          minDistance = dist;
          bestSegmentIndex = i;
          bestOffset = projection.offset;
        } else if (minDistance > this.proximityThreshold) {
          // If we haven't found a close segment yet, track the closest one
          minDistance = dist;
          bestSegmentIndex = i;
          bestOffset = clampedOffset;
        }
      }
    }

    // Handle edge cases where car might be slightly ahead of current segment
    // If offset > 1 and there's a next segment, consider moving to it
    if (bestOffset > 1 && bestSegmentIndex < this.path.length - 1) {
      const nextEdge = this.path[bestSegmentIndex + 1];
      const nextProjection = nextEdge.projectNode(pos);
      const nextPoint = this.getPointOnEdge(
        nextEdge,
        Math.max(0, Math.min(1, nextProjection.offset)),
      );
      const nextDist = distance(pos, nextPoint);

      if (nextDist <= this.proximityThreshold && nextProjection.offset >= 0) {
        bestSegmentIndex++;
        bestOffset = nextProjection.offset;
      }
    }

    // Clamp offset for final calculation
    const clampedOffset = Math.max(0, Math.min(1, bestOffset));

    // Calculate total progress
    const previousLength =
      bestSegmentIndex > 0 ? this.cumulativeLengths[bestSegmentIndex - 1] : 0;
    const currentSegmentLength = this.path[bestSegmentIndex].length();
    const progressInSegment = clampedOffset * currentSegmentLength;
    const totalProgress =
      (previousLength + progressInSegment) / this.totalPathLength;

    // Check if reached destination
    const lastEdge = this.path[this.path.length - 1];
    const distToDestination = distance(pos, lastEdge.n2);
    const reachedDestination = distToDestination <= this.destinationThreshold;

    return {
      carId: car.id,
      segmentIndex: bestSegmentIndex,
      segmentOffset: clampedOffset,
      totalProgress: Math.max(0, Math.min(1, totalProgress)),
      reachedDestination,
      isDamaged: car.damaged,
    };
  }

  /**
   * Get a point on an edge at a given offset (0-1).
   */
  private getPointOnEdge(edge: Edge, offset: number): Node {
    return new Node(
      edge.n1.x + (edge.n2.x - edge.n1.x) * offset,
      edge.n1.y + (edge.n2.y - edge.n1.y) * offset,
    );
  }

  /**
   * Compare two progress values to determine which is better.
   *
   * @returns true if progressA is better than progressB.
   */
  private isBetterProgress(
    progressA: CarProgress,
    progressB: CarProgress,
  ): boolean {
    // Reached destination is always best
    if (progressA.reachedDestination && !progressB.reachedDestination) {
      return true;
    }
    if (!progressA.reachedDestination && progressB.reachedDestination) {
      return false;
    }

    // If same destination state, compare total progress
    const progressDiff = progressA.totalProgress - progressB.totalProgress;

    // If progress is significantly different, use that
    if (Math.abs(progressDiff) > 0.01) {
      return progressDiff > 0;
    }

    // If progress is similar, prefer undamaged cars
    if (progressA.isDamaged !== progressB.isDamaged) {
      return !progressA.isDamaged;
    }

    // Otherwise, use raw progress
    return progressDiff > 0;
  }
}
