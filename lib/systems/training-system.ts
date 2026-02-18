import { Car } from "@/lib/car/car";
import { Edge } from "@/lib/primitives/edge";
import { Node } from "@/lib/primitives/node";
import { Polygon } from "@/lib/primitives/polygon";
import { Envelope } from "@/lib/primitives/envelope";
import { ROAD_WIDTH } from "@/env";
import { distance } from "@/utils/math";

/**
 * Represents a segment of the path from source to destination.
 *
 * Each segment corresponds to one edge in the path. The `polygon` is the
 * envelope around that edge, used for containment checks. Segments are
 * stored in order from source (index 0) to destination (index n-1).
 */
export interface PathSegment {
  /** Index of this segment in the path (0 = closest to source). */
  index: number;
  /** The underlying edge of the path. */
  edge: Edge;
  /** Envelope polygon around the edge for containment checks. */
  polygon: Polygon;
  /** Cumulative path length at the start of this segment. */
  cumulativeLengthStart: number;
  /** Cumulative path length at the end of this segment. */
  cumulativeLengthEnd: number;
}

export interface CarProgress {
  carId: number;
  segmentIndex: number;
  segmentOffset: number;
  totalProgress: number;
  reachedDestination: boolean;
  isDamaged: boolean;
}

export interface TrainingStats {
  generation: number;
  totalCars: number;
  activeCars: number;
  reachedDestination: number;
  bestFitness: number;
  bestCarId: number | null;
  isTraining: boolean;
  generationComplete: boolean;
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
    this.progressMap.clear();
    let cumulativeLength = 0;
    for (let i = 0; i < pathEdges.length; i++) {
      const edge = pathEdges[i];
      const edgeLength = edge.length();
      const envelope = new Envelope(edge, ROAD_WIDTH, 8);
      this.segments.push({
        index: i,
        edge: edge,
        polygon: envelope.poly,
        cumulativeLengthStart: cumulativeLength,
        cumulativeLengthEnd: cumulativeLength + edgeLength,
      });
      cumulativeLength += edgeLength;
    }
    this.totalPathLength = cumulativeLength;
  }

  /**
   * Get all path segments.
   * @returns Array of path segments in order from source to destination
   */
  getSegments(): PathSegment[] {
    return this.segments;
  }

  /**
   * Get the number of segments in the path.
   * @returns Number of segments
   */
  getSegmentCount(): number {
    return this.segments.length;
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
    this.progressMap.clear();
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
    this.generation = 0;
    this.isTraining = false;
    this.progressMap.clear();
  }

  /**
   * Get the current generation number.
   * @returns Current generation
   */
  getGeneration(): number {
    return this.generation;
  }

  /**
   * Check if training is currently active.
   * @returns True if training is active
   */
  getIsTraining(): boolean {
    return this.isTraining;
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

  getProgress(carId: number): CarProgress | undefined {
    return this.progressMap.get(carId);
  }

  getAllProgress(): Map<number, CarProgress> {
    return this.progressMap;
  }

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

  getFitness(carId: number): number {
    const progress = this.progressMap.get(carId);
    if (!progress) return 0;
    if (progress.reachedDestination) {
      return 1.0;
    }
    return Math.min(1, Math.max(0, progress.totalProgress));
  }

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
   * Clear all progress tracking data.
   */
  clearProgress(): void {
    this.progressMap.clear();
  }

  /**
   * Compare two cars' progress within the same segment.
   *
   * When multiple cars are in the same segment, this compares their positions
   * relative to the segment's edge to determine which car is ahead.
   *
   * @param carA - First car
   * @param carB - Second car
   * @param segment - The segment both cars are in
   * @returns Positive if carA is ahead, negative if carB is ahead, 0 if equal
   */
  compareProgressInSegment(carA: Car, carB: Car, segment: PathSegment): number {
    const projectionA = segment.edge.projectNode(carA.position);
    const projectionB = segment.edge.projectNode(carB.position);
    return projectionA.offset - projectionB.offset;
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
    const effectiveSegmentIndex =
      segmentIndex >= 0 ? segmentIndex : this.findNearestSegment(pos);

    const segment = this.segments[effectiveSegmentIndex];
    const projection = segment.edge.projectNode(pos);
    const clampedOffset = Math.max(0, Math.min(1, projection.offset));
    const progressInSegment = clampedOffset * segment.edge.length();
    const absoluteProgress = segment.cumulativeLengthStart + progressInSegment;
    const totalProgress = absoluteProgress / this.totalPathLength;

    const lastSegment = this.segments[this.segments.length - 1];
    const distToDestination = distance(pos, lastSegment.edge.n2);
    const reachedDestination = distToDestination <= this.destinationThreshold;

    return {
      carId: car.id,
      segmentIndex: effectiveSegmentIndex,
      segmentOffset: clampedOffset,
      totalProgress: Math.max(0, Math.min(1, totalProgress)),
      reachedDestination,
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
    let highestContainingIndex = -1;

    // Check all segments and keep track of the highest index that contains the position
    for (let i = 0; i < this.segments.length; i++) {
      if (this.segments[i].polygon.containsNode(pos)) {
        highestContainingIndex = i;
        // Don't break - we want the highest index, so keep checking
      }
    }

    return highestContainingIndex;
  }

  /**
   * Find the nearest segment to a position when no segment contains it.
   *
   * This is a fallback for when the car is outside all segment polygons
   * (e.g., if it has driven off the road).
   *
   * @param pos - Position to find nearest segment for
   * @returns Index of the nearest segment
   */
  private findNearestSegment(pos: Node): number {
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    for (let i = 0; i < this.segments.length; i++) {
      const dist = this.segments[i].edge.distanceToNode(pos);
      if (dist < nearestDistance) {
        nearestDistance = dist;
        nearestIndex = i;
      }
    }
    return nearestIndex;
  }

  /**
   * Determine if progressA represents better progress than progressB.
   *
   * The best car is simply the one that has travelled the farthest along
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
    if (progressA.reachedDestination && !progressB.reachedDestination) {
      return true;
    }
    if (!progressA.reachedDestination && progressB.reachedDestination) {
      return false;
    }
    return progressA.totalProgress > progressB.totalProgress;
  }
}
