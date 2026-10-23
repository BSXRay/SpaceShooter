"use strict";

// --------------------------------------------------
// PERSISTENT STORAGE
// --------------------------------------------------

// Everything the game remembers lives in one namespaced JSON blob in
// localStorage: volumes, ship customization. The Android wrapper loads
// every OTA bundle from the same origin, so saved data survives updates
// and app restarts. When storage is unavailable (private mode, quota,
// tests) the store degrades to an in-memory copy for the session.
const STORE_KEY = "spaceshooter.store.v1";

let memoryStore = null;

// Clamps a number into the 0..1 range used by every slider.
function clamp01(value, fallback = 0) {
  const n = Number(value);

  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
}

function readStore() {
  if (memoryStore) {
    return memoryStore;
  }

  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    const data = raw ? JSON.parse(raw) : null;

    if (data && typeof data === "object") {
      memoryStore = data;
      return memoryStore;
    }
  } catch (e) {
    /* fall through to a fresh in-memory store */
  }

  memoryStore = {};
  return memoryStore;
}

function writeStore() {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(readStore()));
  } catch (e) {
    /* storage unavailable: the in-memory copy still works this session */
  }
}

const store = {
  get(key, fallback) {
    const data = readStore();

    return Object.prototype.hasOwnProperty.call(data, key)
      ? data[key]
      : fallback;
  },

  set(key, value) {
    readStore()[key] = value;
    writeStore();
    return value;
  },

  remove(key) {
    delete readStore()[key];
    writeStore();
  }
};
