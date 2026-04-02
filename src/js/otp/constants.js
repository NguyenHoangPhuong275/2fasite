export const RING_RADIUS = 22;
export const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export const CLOCK_SYNC_MAX_AGE_MS = 5 * 60 * 1000;
export const CLOCK_SYNC_INTERVAL_MS = 5 * 60 * 1000;
export const CLOCK_TIMEOUT_MS = 3500;

export const SERVER_TIME_ENDPOINT = "/api/time";
export const PUBLIC_TIME_API_ENDPOINT = "https://www.timeapi.io/api/Time/current/zone?timeZone=UTC";
