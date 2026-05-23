/**
 * Position Interpolation Utility
 * 
 * Provides smooth animation between GPS positions using cubic ease-in-out easing.
 * This ensures vehicle markers glide smoothly on the map instead of jumping/shaking
 * when rapid position updates arrive.
 */

export interface Path2D {
  lat: number;
  lng: number;
}

export interface AnimatedPosition extends Path2D {
  heading?: number;
}

/**
 * Cubic ease-in-out function for smooth animation
 * @param t - Normalized time (0 to 1)
 * @returns Eased value
 */
export const cubicEaseInOut = (t: number): number => {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

/**
 * Calculate the shortest heading rotation path between two angles
 * @param fromHeading - Starting heading (0-360)
 * @param toHeading - Target heading (0-360)
 * @returns Difference to apply (-180 to 180)
 */
export const calculateHeadingDiff = (fromHeading: number, toHeading: number): number => {
  let diff = toHeading - fromHeading;
  while (diff < -180) diff += 360;
  while (diff > 180) diff -= 360;
  return diff;
};

/**
 * Calculate animation duration based on distance traveled
 * @param fromPoint - Starting position
 * @param toPoint - Ending position
 * @param baseInterval - Update interval in ms (e.g., 150ms from simulator)
 * @returns Duration in ms
 */
export const calculateAnimationDuration = (
  fromPoint: Path2D,
  toPoint: Path2D,
  baseInterval: number = 150
): number => {
  // Distance in lat/lng degrees
  const distance = Math.sqrt(
    Math.pow(toPoint.lat - fromPoint.lat, 2) + 
    Math.pow(toPoint.lng - fromPoint.lng, 2)
  );
  
  // Calculate duration: larger distances = longer animation
  // baseInterval should match your simulator's send frequency
  const baseDuration = baseInterval * 4; // Default ~600ms for 150ms interval
  const duration = baseDuration * Math.min(3, Math.max(0.5, distance * 6000));
  
  return Math.max(300, Math.min(1200, duration)); // Clamp between 300-1200ms
};

/**
 * Animate a vehicle position from one point to another
 * @param fromPoint - Starting position
 * @param toPoint - Ending position
 * @param duration - Animation duration in ms
 * @param fromHeading - Starting heading (optional)
 * @param toHeading - Target heading (optional)
 * @param onUpdate - Callback with interpolated position
 * @param onComplete - Callback when animation finishes
 * @returns Cleanup function to cancel animation
 */
export const animatePosition = (
  fromPoint: Path2D,
  toPoint: Path2D,
  duration: number,
  fromHeading: number | undefined,
  toHeading: number | undefined,
  onUpdate: (pos: AnimatedPosition) => void,
  onComplete: () => void
): (() => void) => {
  const startTime = performance.now();
  let animationFrameId: number | null = null;

  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const t = Math.min(elapsed / duration, 1);

    // Apply cubic easing
    const easedT = cubicEaseInOut(t);

    // Interpolate position
    const lat = fromPoint.lat + (toPoint.lat - fromPoint.lat) * easedT;
    const lng = fromPoint.lng + (toPoint.lng - fromPoint.lng) * easedT;

    // Interpolate heading if provided
    let heading: number | undefined;
    if (toHeading !== undefined && fromHeading !== undefined) {
      const diff = calculateHeadingDiff(fromHeading, toHeading);
      heading = fromHeading + diff * easedT;
    } else if (toHeading !== undefined) {
      heading = toHeading;
    }

    onUpdate({ lat, lng, heading });

    if (t < 1) {
      animationFrameId = requestAnimationFrame(animate);
    } else {
      onComplete();
    }
  };

  animationFrameId = requestAnimationFrame(animate);

  // Return cleanup function
  return () => {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  };
};
