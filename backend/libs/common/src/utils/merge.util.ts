/**
 * Merges updates into a target object without validation
 * @param target - The original object
 * @param updates - The updates to apply
 * @returns A new object with updates merged in
 */
export function merge<T extends Record<string, any>>(
  target: T,
  updates: Partial<T>,
): T {
  return { ...target, ...updates };
}
