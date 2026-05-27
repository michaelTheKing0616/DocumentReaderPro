/**
 * Dev lab gate for mock gaze streams and scaffold data.
 * Enabled only when EXPO_PUBLIC_DEV_LAB === 'true'. Never active in production builds.
 */
export function isDevLabEnabled(): boolean {
  if (typeof __DEV__ !== 'undefined' && !__DEV__) {
    return false;
  }
  return process.env.EXPO_PUBLIC_DEV_LAB === 'true';
}

/** @deprecated Prefer isDevLabEnabled — kept for call sites migrating off __DEV__ mocks. */
export function isMockDataEnabled(): boolean {
  return isDevLabEnabled();
}
