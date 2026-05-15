type MpSdk = unknown;

declare global {
  interface Window {
    MP_SDK?: MpSdk;
    MATTERPORT_SDK_LOADED?: boolean;
  }
}

let loadPromise: Promise<void> | null = null;

export async function loadMatterportBundle(bundleUrl: string): Promise<void> {
  if (window.MATTERPORT_SDK_LOADED) return;

  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = bundleUrl;
    script.async = true;
    script.onload = () => {
      window.MATTERPORT_SDK_LOADED = true;
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
