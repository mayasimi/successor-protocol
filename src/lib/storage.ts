/**
 * Typed wrappers around localStorage.
 */

export function getItem<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const item = window.localStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : null;
  } catch {
    return null;
  }
}

export function setItem<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    console.error("Failed to write to localStorage");
  }
}

export function removeItem(key: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
}
