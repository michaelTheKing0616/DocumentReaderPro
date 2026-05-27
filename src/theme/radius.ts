export const radius = {
  /** 4px — subtle rounding */
  sm: 4,
  /** 8px — buttons, inputs */
  md: 8,
  /** 12px — cards */
  lg: 12,
  /** 16px — modals, sheets */
  xl: 16,
  /** Full pill shape */
  full: 9999,
} as const;

export type Radius = typeof radius;
