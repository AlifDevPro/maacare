import { getFirebasePublicConfig } from "@/lib/push/firebase-config";
import {
  absoluteAssetUrl,
  getPushNotificationIconUrl,
  PUSH_ICON_PATHS,
} from "@/lib/push/notification-assets";

const PWA_LIFECYCLE = `
self.addEventListener("message", function (event) {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});
`.trim();

export async function GET() {
  const config = getFirebasePublicConfig();
  const iconUrl = getPushNotificationIconUrl();
  const badgeUrl = absoluteAssetUrl(PUSH_ICON_PATHS.notificationBadge);
  const defaultUrl = absoluteAssetUrl("/app");

  if (!config) {
    return new Response(PWA_LIFECYCLE, {
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=0, must-revalidate",
        "Service-Worker-Allowed": "/",
      },
    });
  }

  const script = `
${PWA_LIFECYCLE}

importScripts("https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js");

firebase.initializeApp(${JSON.stringify(config)});
const messaging = firebase.messaging();

var PUSH_ICON = ${JSON.stringify(iconUrl)};
var PUSH_BADGE = ${JSON.stringify(badgeUrl)};
var DEFAULT_URL = ${JSON.stringify(defaultUrl)};

function showMaacareNotification(title, options) {
  var opts = Object.assign(
    {
      icon: PUSH_ICON,
      badge: PUSH_BADGE,
      tag: "maacare",
      renotify: true,
    },
    options || {},
  );
  return self.registration.showNotification(title, opts);
}

function payloadToNotification(payload) {
  var notification = payload.notification || {};
  var data = payload.data || {};
  return {
    title: notification.title || data.title || "MaaCare",
    options: {
      body: notification.body || data.body || "",
      icon: notification.icon || data.icon || PUSH_ICON,
      badge: PUSH_BADGE,
      tag: data.tag || "maacare",
      data: { url: data.url || DEFAULT_URL },
    },
  };
}

messaging.onBackgroundMessage(function (payload) {
  var n = payloadToNotification(payload);
  return showMaacareNotification(n.title, n.options);
});

self.addEventListener("push", function (event) {
  if (!event.data) return;
  try {
    var payload = event.data.json();
    var n = payloadToNotification(payload);
    event.waitUntil(showMaacareNotification(n.title, n.options));
  } catch (e) {
    var text = event.data.text();
    event.waitUntil(
      showMaacareNotification("MaaCare", {
        body: text,
        data: { url: DEFAULT_URL },
      }),
    );
  }
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var target = (event.notification.data && event.notification.data.url) || DEFAULT_URL;
  var url = new URL(target, self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var client = list[i];
        if (client.url.indexOf(self.location.origin) === 0 && "focus" in client) {
          if ("navigate" in client) {
            return client.navigate(url).then(function () {
              return client.focus();
            });
          }
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    }),
  );
});
`.trim();

  return new Response(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Service-Worker-Allowed": "/",
    },
  });
}
