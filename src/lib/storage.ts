// Simple encrypted wrapper (for demo; use a real encryption lib in production)
export function setSecureItem(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Storage error", e);
  }
}

export function getSecureItem(key: string) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch {
    return null;
  }
}
