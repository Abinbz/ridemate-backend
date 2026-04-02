import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// ═══════════════════════════════════════════════════════
// Firebase Configuration
// ═══════════════════════════════════════════════════════
const firebaseConfig = {
  apiKey: "AIzaSyCPsdueZcp8__opFuAJSF5gF2qx2xCnoZA",
  authDomain: "ridemate-8043e.firebaseapp.com",
  projectId: "ridemate-8043e",
  storageBucket: "ridemate-8043e.firebasestorage.app",
  messagingSenderId: "681517222282",
  appId: "1:681517222282:web:88dfb71938449a376fe073"
};

const VAPID_KEY = "BCV1SJyWGV2C7jx56Dz8NPh7TgDswZdur-Ym1bAvcX5s71CW3DC_PiNZ0BIrMBLkc3Bju7cHq45p63mIGkAWmmI";

// ═══════════════════════════════════════════════════════
// Initialization
// ═══════════════════════════════════════════════════════
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// ═══════════════════════════════════════════════════════
// Permission + Token
// ═══════════════════════════════════════════════════════

/**
 * Request browser notification permission and retrieve FCM token.
 * Returns the token string on success, or null if unavailable.
 */
const requestPermissionAndToken = async () => {
  try {
    console.log('[Firebase] Requesting permission...');
    const permission = await Notification.requestPermission();
    console.log('[Firebase] Permission status:', permission);

    if (permission !== 'granted') {
      return null;
    }

    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (token) {
      console.log('[Firebase] FCM Token generated:', token);
    } else {
      console.warn('[Firebase] No registration token available. Request permission to generate one.');
    }
    return token;
  } catch (err) {
    console.error('[Firebase] Token error:', err);
    return null;
  }
};

// ═══════════════════════════════════════════════════════
// Foreground Message Listener
// ═══════════════════════════════════════════════════════

/**
 * Subscribe to foreground push messages.
 * Returns a Promise that resolves with the message payload.
 */
const onMessageListener = () => {
  return new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      console.log('[Firebase] Received foreground message:', payload);
      resolve(payload);
    });
  });
};

/**
 * Callback-based foreground listener (used by UserHome).
 * Returns an unsubscribe function.
 */
const onForegroundMessage = (callback) => {
  return onMessage(messaging, (payload) => {
    console.log('[Firebase] Received foreground message (callback):', payload);
    callback(payload);
  });
};

export {
  messaging,
  requestPermissionAndToken,
  onMessageListener,
  onForegroundMessage
};
