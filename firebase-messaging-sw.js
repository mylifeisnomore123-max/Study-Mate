// This file MUST be served from the site root (same folder as index.html),
// named exactly "firebase-messaging-sw.js".

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDbnONzsvSa4nb8_K47cs10N0Gv5MK1DZc",
  authDomain: "studymate-72f7b.firebaseapp.com",
  projectId: "studymate-72f7b",
  storageBucket: "studymate-72f7b.firebasestorage.app",
  messagingSenderId: "494648741720",
  appId: "1:494648741720:web:bff97c32645e13894f9f2d"
});

const messaging = firebase.messaging();

// Handles notifications that arrive while the app/browser is closed or in background.
messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || 'StudyMate';
  const body = (payload.notification && payload.notification.body) || 'তোমার রুটিনে একটা রিমাইন্ডার আছে।';
  self.registration.showNotification(title, {
    body,
    icon: 'icon.png',
    badge: 'icon.png'
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
