export function loadFromStorage(key, fallback) {
  try {
    const rawValue = window.localStorage.getItem(key)
    if (!rawValue) {
      return fallback
    }
    return JSON.parse(rawValue)
  } catch (_error) {
    return fallback
  }
}

export function saveToStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch (_error) {
    // No-op for browser privacy mode / storage cap.
  }
}
