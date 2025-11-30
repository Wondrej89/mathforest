// js/storage.js

const KEY = "math-forest-save";

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveProgress(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // nic – když storage selže, hra se prostě neuloží
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
