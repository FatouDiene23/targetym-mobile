import { useState, useEffect } from "react";

const STORAGE_KEY = "budget-rh-selected-year";

export function useBudgetYear() {
  const currentYear = new Date().getFullYear();
  const defaultYear = currentYear + 1;

  const [year, setYearState] = useState<number>(defaultYear);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed)) setYearState(parsed);
    }
  }, []);

  const setYear = (y: number) => {
    localStorage.setItem(STORAGE_KEY, String(y));
    setYearState(y);
  };

  return { year, setYear, currentYear };
}
