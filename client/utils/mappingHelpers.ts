/**
 * Helper utilities for admin mapping components
 */

/**
 * Check if a status value represents an active state
 * @param status - The status string to check
 * @returns true if status is active, false otherwise
 */
export const isActiveStatus = (status?: string): boolean => {
  return status?.toLowerCase() === "active";
};

/**
 * Filter array to only include active items based on status field
 * @param items - Array of items with status field
 * @returns Filtered array with only active items
 */
export const filterActiveItems = <T extends { status?: string }>(items: T[]): T[] => {
  return items.filter(item => isActiveStatus(item.status));
};

/**
 * Filter array to exclude items by their IDs
 * @param items - Array of items to filter
 * @param excludedIds - Set of IDs to exclude
 * @returns Filtered array excluding specified IDs
 */
export const filterExcludedIds = <T extends { _id: string | { toString: () => string } }>(
  items: T[], 
  excludedIds: Set<string>
): T[] => {
  return items.filter(item => !excludedIds.has(item._id?.toString?.() || item._id?.toString() || ''));
};
