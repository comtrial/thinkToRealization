/**
 * Register Service Worker and subscribe to Web Push notifications.
 * SSR-safe: all browser APIs are guarded.
 */

let vapidKeyCache: string | null = null;

async function getVapidPublicKey(): Promise<string> {
  if (vapidKeyCache) return vapidKeyCache;
  const res = await fetch("/api/push/vapid-key");
  if (!res.ok) throw new Error("Failed to fetch VAPID key");
  const { data } = await res.json();
  vapidKeyCache = data.publicKey;
  return data.publicKey;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const outputArray = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) {
    outputArray[i] = raw.charCodeAt(i);
  }
  return outputArray;
}

export async function registerAndSubscribe(): Promise<PushSubscription | null> {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    // Sync to server in case it was lost
    await syncSubscriptionToServer(existing);
    return existing;
  }

  const vapidKey = await getVapidPublicKey();
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
  });

  await syncSubscriptionToServer(subscription);
  return subscription;
}

async function syncSubscriptionToServer(subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON();
  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: {
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
      },
    }),
  });
}

export async function unsubscribeFromPush(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await fetch("/api/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
}

export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "serviceWorker" in navigator && "PushManager" in window;
}
