import { Platform } from 'react-native';

// Android emulators reach the host machine at 10.0.2.2; everything else uses
// localhost unless EXPO_PUBLIC_API_URL points at a LAN IP or a deployed API.
const fallback = Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? fallback).replace(/\/$/, '');

/**
 * While the platform is a prototype, every rendered document carries a visible
 * "specimen" watermark so screenshots cannot pass as real ID. Set
 * EXPO_PUBLIC_PROTOTYPE=false only once the issuing authority has commissioned
 * the app and real credentials are being issued.
 */
export const IS_PROTOTYPE = process.env.EXPO_PUBLIC_PROTOTYPE !== 'false';

export const APP_NAME = 'CivicPass';

/** Seconds before an on-screen QR code is refreshed (server TTL is 90s). */
export const QR_REFRESH_SECONDS = 60;

/**
 * Demo mode runs a built-in, in-memory backend (src/lib/demo) instead of
 * calling the API, so the app works with no server. Used for the hosted web
 * preview, store review builds and sales demos.
 */
export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';
