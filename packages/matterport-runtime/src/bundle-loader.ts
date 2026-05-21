/** Default Matterport showcase-sdk bundle from their CDN. */
export const DEFAULT_BUNDLE_URL =
  "https://static.matterport.com/showcase-sdk/2.0.0-0-g6b74232d2/sdk.js";

let loadPromise: Promise<void> | null = null;

/**
 * Loads the Matterport showcase-sdk script once and caches the promise.
 * After resolution, `window.MP_SDK` is available and ready to connect.
 */
export async function loadMatterportBundle(
  bundleUrl: string = DEFAULT_BUNDLE_URL
): Promise<void> {
  if ((window as Window & { MATTERPORT_SDK_LOADED?: boolean }).MATTERPORT_SDK_LOADED) return;
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = bundleUrl;
    script.async = true;
    script.onload = () => {
      (window as Window & { MATTERPORT_SDK_LOADED?: boolean }).MATTERPORT_SDK_LOADED = true;
      resolve();
    };
    script.onerror = () => {
      loadPromise = null;
      reject(new Error(`Failed to load Matterport bundle from: ${bundleUrl}`));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
