/**
 * Firebase setup and Google authentication.
 *
 * This file downloads the Firebase SDK. The editor reaches it through ./cloud.js,
 * which loads it in the background. The configuration is in ./config.js.
 */

import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { appCheckSiteKey, firebaseConfig, isFirebaseConfigured } from './config';

export { isFirebaseConfigured };

const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;

// App Check proves to Firebase that requests come from this site and not from a script
// using the public API key. It only blocks anything once enforcement is turned on in the
// Firebase console.
if (app && appCheckSiteKey) {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

/**
 * Opens the Google sign in popup.
 * @returns {Promise<object>} The signed in user.
 */
export function signInWithGoogle() {
  if (!auth) {
    return Promise.reject(new Error('Firebase is not configured.'));
  }
  return signInWithPopup(auth, new GoogleAuthProvider()).then(result => result.user);
}

/**
 * Signs the current user out.
 * @returns {Promise}
 */
export function signOutUser() {
  if (!auth) return Promise.resolve();
  return signOut(auth);
}

/**
 * Calls the callback with the current user (or null) every time the sign in state changes.
 * @param {function} callback
 * @returns {function} Function that stops listening.
 */
export function onUserChange(callback) {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}
