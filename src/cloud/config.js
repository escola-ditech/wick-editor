/**
 * Firebase configuration, read from VITE_FIREBASE_* environment variables
 * (see .env.example). If they are not set, the editor keeps working without
 * accounts and saves/loads projects as files only.
 *
 * This file must not import the Firebase SDK, so it can be used without downloading it.
 */

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Optional: reCAPTCHA Enterprise site key used by Firebase App Check.
export const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY;

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId
);
