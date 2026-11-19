/**
 * Firebase setup and Google authentication.
 *
 * The configuration is read from REACT_APP_FIREBASE_* environment variables
 * (see .env). If they are not set, the editor keeps working without accounts
 * and saves/loads projects as files only.
 */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId
);

const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;

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
