"use client";

import { useState } from "react";
import { getItem, setItem } from "@/lib/storage";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(
    () => getItem<T>(key) ?? initialValue
  );

  const setValue = (value: T | ((prev: T) => T)) => {
    const valueToStore =
      value instanceof Function ? value(storedValue) : value;
    setStoredValue(valueToStore);
    setItem(key, valueToStore);
  };

  return [storedValue, setValue] as const;
}
