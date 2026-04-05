import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { API_BASE_URL } from './config/api';
import './App.css';
import Authentication from './components/Authentication';
import UserHome from './components/UserHome';
import AdminHome from './components/AdminHome';
import ResultsPage from './components/pages/ResultsPage';
import RideDetailsPage from './components/pages/RideDetailsPage';
import EditProfilePage from './components/pages/EditProfilePage';
import RatingsPage from './components/pages/RatingsPage';
import ReportsPage from './components/pages/ReportsPage';
import ChatPage from './components/pages/ChatPage';
import MyRidesPage from './components/pages/MyRidesPage';
import MyRideDetailsPage from './components/pages/MyRideDetailsPage';
import RideHistoryPage from './components/pages/RideHistoryPage';
import MapPicker from './components/pages/MapPicker';
import AdminDashboard from './components/pages/AdminDashboard';
import AdminUsersPage from './components/pages/AdminUsersPage';
import AdminRidesPage from './components/pages/AdminRidesPage';
import AdminRideDetailsPage from './components/pages/AdminRideDetailsPage';
import AdminVerificationPage from './components/pages/AdminVerificationPage';
import AdminReportsPage from './components/pages/AdminReportsPage';
import UserVerificationPage from './components/pages/UserVerificationPage';
import NotificationsPage from './components/pages/NotificationsPage';
import { ToastProvider, useToast } from './context/ToastContext';
import { Navigate } from 'react-router-dom';

// ── PWA CONTEXT ──
const PWAContext = createContext();

export const usePWA = () => {
  const context = useContext(PWAContext);
  if (!context) {
    throw new Error('usePWA must be used within a PWAProvider');
  }
  return context;
};

// Admin Protected Route
const AdminProtectedRoute = ({ children }) => {
  const userId = localStorage.getItem('userId');
  const isAdminToken = localStorage.getItem('isAdmin'); // We'll set this in Authentication.js

  if (isAdminToken !== 'true') {
    return <Navigate to="/" replace />;
  }
  return children;
};

// Sub-component to handle logic that needs context access
function AppContent() {
  const { showToast } = useToast();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if ("Notification" in window) {
      Notification.requestPermission();
    }

    // 1. Detect if app is already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone || window.navigator.standalone) {
      setIsInstalled(true);
    }

    // 2. Capture beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      console.log('👍 beforeinstallprompt captured');
    };

    // 3. Listen for appinstalled event
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
      showToast('RideMate installed successfully!', 'success');
      console.log('👍 PWA was installed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [showToast]);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`👤 User response to install prompt: ${outcome}`);
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const showInstall = deferredPrompt !== null;
  const userId = localStorage.getItem('userId');

  // Real-time (polling) notification support for demo
  useEffect(() => {
    if (!userId) return;

    const checkNewNotifications = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/notifications/unread-count/${userId}`);
        const data = await res.json();
        
        if (data.success && data.count > 0) {
           // Fetch the latest unread ones
           const nRes = await fetch(`${API_BASE_URL}/api/notifications?userId=${userId}`);
           const nData = await nRes.json();
           if (nData.success) {
              const latestUnread = nData.notifications.filter(n => !n.isRead)[0];
              if (latestUnread) {
                 import('./utils/notifications').then(({ showNotification }) => {
                    showNotification(latestUnread.title, latestUnread.message);
                 });
                 // Mark it as read immediately for the demo so it doesn't repeat
                 fetch(`${API_BASE_URL}/api/notifications/read/${latestUnread._id || latestUnread.id}`, { method: 'POST' });
              }
           }
        }
      } catch (err) {
        console.error("Poller Error:", err);
      }
    };

    const interval = setInterval(checkNewNotifications, 10000); // Check every 10s
    return () => clearInterval(interval);
  }, [userId]);

  return (
    <PWAContext.Provider value={{ handleInstall, showInstall, isInstalled }}>
      <div className="app-viewport">
        <Router>
          <div className="main-content scrollbar-hide">
            <Routes>
          <Route path="/" element={<Authentication />} />
          <Route path="/user/home" element={<UserHome />} />
          <Route path="/admin/home" element={<AdminHome />} />
          <Route path="/user/results" element={<ResultsPage />} />
          <Route path="/user/ride-details" element={<RideDetailsPage />} />
          <Route path="/user/edit-profile" element={<EditProfilePage />} />
          <Route path="/user/ratings" element={<RatingsPage />} />
          <Route path="/user/reports" element={<ReportsPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/user/my-rides" element={<MyRidesPage />} />
          <Route path="/user/my-rides/details" element={<MyRideDetailsPage />} />
          <Route path="/user/ride-history" element={<RideHistoryPage />} />
          <Route path="/user/verify" element={<UserVerificationPage />} />
          <Route path="/user/notifications" element={<NotificationsPage />} />
          <Route path="/map-picker" element={<MapPicker />} />

          {/* Admin Routes */}
          <Route path="/admin/home" element={<AdminProtectedRoute><AdminHome /></AdminProtectedRoute>} />
          <Route path="/admin/dashboard" element={<AdminProtectedRoute><AdminHome><AdminDashboard /></AdminHome></AdminProtectedRoute>} />
          <Route path="/admin/users" element={<AdminProtectedRoute><AdminHome><AdminUsersPage /></AdminHome></AdminProtectedRoute>} />
          <Route path="/admin/rides" element={<AdminProtectedRoute><AdminHome><AdminRidesPage /></AdminHome></AdminProtectedRoute>} />
          <Route path="/admin/ride/:id" element={<AdminProtectedRoute><AdminHome><AdminRideDetailsPage /></AdminHome></AdminProtectedRoute>} />
          <Route path="/admin/verifications" element={<AdminProtectedRoute><AdminHome><AdminVerificationPage /></AdminHome></AdminProtectedRoute>} />
          <Route path="/admin/reports" element={<AdminProtectedRoute><AdminHome><AdminReportsPage /></AdminHome></AdminProtectedRoute>} />
            </Routes>
          </div>
        </Router>
      </div>
    </PWAContext.Provider>
  );
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

export default App;



