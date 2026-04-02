/* eslint-disable no-restricted-globals */
/* eslint-disable no-undef */

// Firebase Messaging Service Worker
// This handles push notifications when the app is in the background.

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyCPsdueZcp8__opFuAJSF5gF2qx2xCnoZA",
  authDomain: "ridemate-8043e.firebaseapp.com",
  projectId: "ridemate-8043e",
  storageBucket: "ridemate-8043e.firebasestorage.app",
  messagingSenderId: "681517222282",
  appId: "1:681517222282:web:88dfb71938449a376fe073"
};

// Initialize Firebase App for the service worker
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[FCM SW] Background message:', payload);

  const title = payload.notification?.title || payload.data?.title || 'RideMate';
  const options = {
    body: payload.notification?.body || payload.data?.body || 'You have a new notification',
    icon: '/logo192.png',
    badge: '/logo192.png',
    tag: payload.data?.type || 'ridemate-notification',
    data: payload.data || {},
    vibrate: [100, 50, 100],
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  self.registration.showNotification(title, options);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  // Focus existing window or open new one
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        return self.clients.openWindow('/user/home');
      })
  );
});
