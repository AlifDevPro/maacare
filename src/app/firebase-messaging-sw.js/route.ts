import { getFirebasePublicConfig } from "@/lib/push/firebase-config";

export async function GET() {
  const config = getFirebasePublicConfig();
  if (!config) {
    return new Response("// FCM not configured", {
      headers: { "Content-Type": "application/javascript; charset=utf-8" },
    });
  }

  const script = `
importScripts("https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js");

firebase.initializeApp(${JSON.stringify(config)});
const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  const notification = payload.notification || {};
  const data = payload.data || {};
  const title = notification.title || data.title || "MaaCare";
  const options = {
    body: notification.body || data.body || "",
    icon: notification.icon || "/window.svg",
    badge: "/window.svg",
    tag: data.tag || "maacare",
    data: { url: data.url || "/app" },
    renotify: true,
  };
  return self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var target = (event.notification.data && event.notification.data.url) || "/app";
  var url = new URL(target, self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var client = list[i];
        if (client.url.indexOf(self.location.origin) === 0 && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
`.trim();

  return new Response(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
