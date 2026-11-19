/**
 * Accounts and projects saved in the user's account, as used by the editor.
 *
 * The Firebase SDK is large, so it is not part of the code the editor needs to
 * start. It is downloaded in the background the first time something here is used
 * (the editor does that right after starting, to find out who is signed in).
 */

import { isFirebaseConfigured } from './config';

export { isFirebaseConfigured };

// The functions of ./firebase.js and ./cloudProjects.js, once they were downloaded.
let loaded = null;
let loading = null;

function loadCloud() {
  if (!loading) {
    loading = Promise.all([import('./firebase'), import('./cloudProjects')])
      .then(([firebase, projects]) => {
        loaded = { ...firebase, ...projects };
        return loaded;
      })
      .catch(error => {
        // Try again the next time something is asked for.
        loading = null;
        throw error;
      });
  }
  return loading;
}

/**
 * Opens the Google sign in popup.
 * @returns {Promise<object>} The signed in user.
 */
export function signInWithGoogle() {
  // Browsers only allow the popup to open while the click is being handled,
  // so nothing may be awaited here once the code is available.
  if (loaded) return loaded.signInWithGoogle();
  return loadCloud().then(cloud => cloud.signInWithGoogle());
}

/**
 * Signs the current user out.
 * @returns {Promise}
 */
export function signOutUser() {
  return loadCloud().then(cloud => cloud.signOutUser());
}

/**
 * Calls the callback with the current user (or null) every time the sign in state changes.
 * If accounts are not available, it is called once with null.
 * @param {function} callback
 * @returns {function} Function that stops listening.
 */
export function onUserChange(callback) {
  if (!isFirebaseConfigured) {
    callback(null);
    return () => {};
  }

  let stopped = false;
  let stop = null;
  loadCloud().then(cloud => {
    if (!stopped) stop = cloud.onUserChange(callback);
  }).catch(error => {
    console.error(error);
    if (!stopped) callback(null);
  });

  return () => {
    stopped = true;
    stop && stop();
  };
}

/**
 * Creates an id for a project that was never saved to the user's account.
 * Can only be used after one of the functions below has finished, like listCloudProjects.
 * @param {string} uid User id.
 * @returns {string}
 */
export function newCloudProjectId(uid) {
  return loaded.newCloudProjectId(uid);
}

// See ./cloudProjects.js for what these do.
export const saveCloudProject = (...args) => loadCloud().then(cloud => cloud.saveCloudProject(...args));
export const listCloudProjects = (...args) => loadCloud().then(cloud => cloud.listCloudProjects(...args));
export const loadCloudProject = (...args) => loadCloud().then(cloud => cloud.loadCloudProject(...args));
export const deleteCloudProject = (...args) => loadCloud().then(cloud => cloud.deleteCloudProject(...args));
