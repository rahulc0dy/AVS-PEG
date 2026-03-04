import { Car } from "@/lib/car/car";
import { Edge } from "@/lib/primitives/edge";
import { Node } from "@/lib/primitives/node";
import { Polygon } from "@/lib/primitives/polygon";
import { Envelope } from "@/lib/primitives/envelope";
import { ROAD_WIDTH } from "@/env";
import { distance, getNearestEdge } from "@/utils/math";

/**
 * Represents a segment of the path from source to destination.
 *
 * Each segment corresponds to one edge in the path. The `polygon` is the
 * envelope around that edge, used for containment checks. Segments are
 * stored in order from source (index 0) to destination (index n-1).
 */
export interface PathSegment {
  /** The underlying edge of the path. */
  edge: Edge;
  /** Envelope polygon around the edge for containment checks. */
  polygon: Polygon;
  /** Cumulative path length at the start of this segment. */
  cumulativeLengthStart: number;
  /** Cumulative path length at the end of this segment. */
  cumulativeLengthEnd: number;
}

/**
 * Represents the progress state of a car along the training path.
 */
export interface CarProgress {
  /** Normalized progress along the path, ranging from 0 (start) to 1 (end). */
  totalProgress: number;
  /** Whether the car has reached the destination within the threshold distance. */
  hasReachedDestination: boolean;
  /** Whether the car has been damaged (e.g., collision). */
  isDamaged: boolean;
}

/**
 * Statistics for the current training generation.
 */
export interface TrainingStats {
  /** Number of cars that have successfully reached the destination. */
  numOfCarsReachedDestination: number;
  /** Fitness score of the best-performing car (0 to 1). */
  bestFitness: number;
  /** ID of the best-performing car, or null if no cars are being tracked. */
  bestCarId: number | null;
  /** Whether all cars have either reached the destination or been damaged. */
  isGenerationComplete: boolean;
}

/**
 * Tracks car progress along a path and provides fitness metrics for training.
 *
 * Progress tracking uses individual segment polygons (envelopes) to determine
 * which segment a car is in. Since polygons overlap at segment boundaries,
 * the system always chooses the **highest-indexed** (most advanced) polygon
 * that contains the car. Within a segment, progress is calculated by projecting
 * the car's position onto the segment's edge.
 */
export class TrainingSystem {
  /** Path segments in order from source (index 0) to destination. */
  private segments: PathSegment[] = [];
  /** Total path length for normalizing progress to [0, 1]. */
  private totalPathLength: number = 0;
  /** Current progress state for each car, keyed by car ID. */
  private progressMap: Map<number, CarProgress> = new Map();
  /** Current generation number for training. */
  private generation: number = 0;
  /** Whether training is currently active. */
  private isTraining: boolean = false;
  /** Distance threshold for considering a car as having reached destination. */
  private readonly destinationThreshold: number = 30;
  /** Currently highlighted best car ID (for visual feedback). */
  private currentBestCarId: number | null = null;

  /**
   * Set the path for tracking car progress.
   *
   * Creates envelope polygons for each edge in the path. Segments are stored
   * in order from source to destination, which is critical for the progress
   * tracking algorithm that chooses the highest-indexed containing polygon.
   *
   * @param pathEdges - Ordered edges from source to destination
   */
  setPath(pathEdges: Edge[]): void {
    this.segments = [];
    this.clearProgress();

    let cumulativeLength = 0;
    for (const pathEdge of pathEdges) {
      const edgeLength = pathEdge.length();
      const envelope = new Envelope(pathEdge, ROAD_WIDTH, 8);
      this.segments.push({
        edge: pathEdge,
        polygon: envelope.poly,
        cumulativeLengthStart: cumulativeLength,
        cumulativeLengthEnd: cumulativeLength + edgeLength,
      });
      cumulativeLength += edgeLength;
    }

    this.totalPathLength = cumulativeLength;
  }

  /**
   * Start a training session.
   * @param incrementGeneration - Whether to increment the generation counter
   */
  startTraining(incrementGeneration: boolean = true): void {
    if (incrementGeneration) {
      this.generation++;
    }
    this.isTraining = true;
    this.clearProgress();
  }

  /**
   * Stop the current training session.
   */
  stopTraining(): void {
    this.isTraining = false;
  }

  /**
   * Reset all training state including generation counter.
   */
  reset(): void {
    this.stopTraining();
    this.clearProgress();
    this.generation = 0;
    this.currentBestCarId = null;
  }

  /**
   * Get the current generation number.
   * @returns Current generation
   */
  getGeneration(): number {
    return this.generation;
  }

  /**
   * Update progress for all cars.
   *
   * Should be called each frame during training to track car positions
   * and calculate fitness scores.
   *
   * @param cars - Array of cars to track
   */
  update(cars: Car[]): void {
    if (
      !this.isTraining ||
      this.segments.length === 0 ||
      this.totalPathLength === 0
    ) {
      return;
    }
    for (const car of cars) {
      // Skip recalculation for damaged cars — their progress is frozen
      // at the peak value they reached before the collision.
      const existing = this.progressMap.get(car.id);
      if (existing && existing.isDamaged) continue;

      const progress = this.calculateCarProgress(car);

      // Only accept the new progress if it's >= the previous best.
      // This prevents regression when the car slides backward after
      // a collision or falls outside all segment polygons.
      if (existing && existing.totalProgress > progress.totalProgress) {
        // Keep existing progress but update damage status
        existing.isDamaged = car.damaged;
        continue;
      }

      this.progressMap.set(car.id, progress);
    }

    // Update the best car highlight
    this.updateBestCarHighlight(cars);
  }

  /**
   * Get the progress state for a specific car.
   *
   * @param carId - ID of the car to get progress for
   * @returns Progress data for the car, or undefined if not tracked
   */
  getProgress(carId: number): CarProgress | undefined {
    return this.progressMap.get(carId);
  }

  /**
   * Get aggregated statistics for the current training generation.
   *
   * @param cars - Array of cars to calculate stats for
   * @returns Training statistics including best fitness and completion status
   */
  getStats(cars: Car[]): TrainingStats {
    const numOfCarsReachedDestination = this.getNumOfCarReachedDestination();
    let bestFitness = 0;
    let bestCarId: number | null = null;
    for (const car of cars) {
      const fitness = this.getFitness(car.id);
      if (fitness > bestFitness) {
        bestFitness = fitness;
        bestCarId = car.id;
      }
    }
    const isGenerationComplete =
      cars.length > 0 &&
      cars.every(
        (car) => car.damaged || this.getProgress(car.id)?.hasReachedDestination,
      );
    return {
      numOfCarsReachedDestination,
      bestFitness,
      bestCarId,
      isGenerationComplete,
    };
  }

  /**
   * Get the best-performing car based on progress.
   *
   * The best car is determined by how far it has traveled along the path,
   * regardless of damage status.
   *
   * @param cars - Array of cars to evaluate
   * @returns The best-performing car, or null if no cars are tracked
   */
  getBestCar(cars: Car[]): Car | null {
    if (cars.length === 0 || this.segments.length === 0) {
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
   * Get the fitness score for a specific car.
   *
   * Fitness is based on progress along the path, normalized to [0, 1].
   * A car that has reached the destination receives a fitness of 1.0.
   *
   * @param carId - ID of the car to get fitness for
   * @returns Fitness score between 0 and 1
   */
  getFitness(carId: number): number {
    const progress = this.progressMap.get(carId);
    if (!progress) return 0;
    if (progress.hasReachedDestination) {
      return 1.0;
    }
    return Math.min(1, Math.max(0, progress.totalProgress));
  }

  /**
   * Get the number of cars that have reached the destination.
   *
   * @returns Count of cars that successfully reached the destination
   */
  getNumOfCarReachedDestination(): number {
    let count = 0;
    for (const progress of this.progressMap.values()) {
      if (progress.hasReachedDestination) {
        count++;
      }
    }
    return count;
  }

  /**
   * Clear all progress tracking data.
   */
  clearProgress(): void {
    this.progressMap.clear();
  }

  /**
   * Update the visual highlight on the best-performing car.
   *
   * Removes highlight from the previous best car and applies it to
   * the new best car. Only changes state when the best car changes.
   *
   * @param cars - Array of all cars
   */
  private updateBestCarHighlight(cars: Car[]): void {
    const bestCar = this.getBestCar(cars);
    const newBestId = bestCar?.id ?? null;

    // Only update if the best car has changed
    if (newBestId === this.currentBestCarId) return;

    // Remove highlight from previous best car
    if (this.currentBestCarId !== null) {
      const prevBestCar = cars.find((c) => c.id === this.currentBestCarId);
      prevBestCar?.setHighlighted(false);
    }

    // Add highlight to new best car
    if (bestCar) {
      bestCar.setHighlighted(true);
    }

    this.currentBestCarId = newBestId;
  }

  /**
   * Calculate progress for a single car.
   *
   * The algorithm finds the highest-indexed segment polygon that contains
   * the car's position. This ensures that when polygons overlap (at segment
   * boundaries), we always choose the most advanced segment the car has reached.
   *
   * @param car - Car to calculate progress for
   * @returns Progress data for the car
   */
  private calculateCarProgress(car: Car): CarProgress {
    const pos = car.position;

    // Find the most advanced segment containing the car
    const segmentIndex = this.findMostAdvancedContainingSegment(pos);

    // If the car is not contained in any segment polygon, find the nearest edge
    // and use that segment for progress calculation. This allows progress to be
    // tracked even when the car slides outside the path boundaries, without
    // regressing to an earlier segment.
    const effectiveSegmentIndex =
      segmentIndex >= 0
        ? segmentIndex
        : this.segments.findIndex(
            (pathSegment) =>
              pathSegment.edge ===
              getNearestEdge(
                pos,
                this.segments.map((seg) => seg.edge),
              ),
          ) || 0;

    const segment = this.segments[effectiveSegmentIndex];
    const projection = segment.edge.projectNode(pos);
    const progressInSegment = projection.offset * segment.edge.length();
    const absoluteProgress = segment.cumulativeLengthStart + progressInSegment;
    const totalProgress = absoluteProgress / this.totalPathLength;

    const lastSegment = this.segments[this.segments.length - 1];
    const distToDestination = distance(pos, lastSegment.edge.n2);
    const hasReachedDestination =
      distToDestination <= this.destinationThreshold;

    return {
      totalProgress,
      hasReachedDestination,
      isDamaged: car.damaged,
    };
  }

  /**
   * Find the most advanced (highest-indexed) segment that contains the position.
   *
   * Since segment polygons overlap at boundaries, a car can be inside multiple
   * polygons simultaneously. This method returns the highest-indexed segment
   * containing the car, ensuring progress never "jumps back" when crossing
   * segment boundaries.
   *
   * @param pos - Position to check
   * @returns Index of the most advanced containing segment, or -1 if not in any
   */
  private findMostAdvancedContainingSegment(pos: Node): number {
    let low = 0;
    let high = this.segments.length - 1;
    let highestContainingIndex = -1;

    // Assumes containment is monotonic across indices for the current path setup.
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (this.segments[mid].polygon.containsNode(pos)) {
        highestContainingIndex = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return highestContainingIndex;
  }

  /**
   * Determine if progressA represents better progress than progressB.
   *
   * The best car is simply the one that has traveled the farthest along
   * the path. Damage is irrelevant — a damaged car that reached segment 5
   * is better than an undamaged car at segment 3, since mutations in the
   * next generation can fix the collision.
   *
   * @param progressA - First progress to compare
   * @param progressB - Second progress to compare
   * @returns True if progressA is better than progressB
   */
  private isBetterProgress(
    progressA: CarProgress,
    progressB: CarProgress,
  ): boolean {
    if (progressA.hasReachedDestination && !progressB.hasReachedDestination) {
      return true;
    }
    if (!progressA.hasReachedDestination && progressB.hasReachedDestination) {
      return false;
    }
    return progressA.totalProgress > progressB.totalProgress;
  }
}
