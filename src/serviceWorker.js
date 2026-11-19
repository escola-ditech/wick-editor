/**
 * The editor does not use a service worker. This removes one that an older
 * version of the editor may have registered in the visitor's browser.
 */
export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(registration => {
      registration.unregister();
    });
  }
}
