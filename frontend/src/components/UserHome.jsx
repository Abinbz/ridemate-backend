import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import SearchPage from './pages/SearchPage';
import PostPage from './pages/PostPage';
import MessagePage from './pages/MessagePage';
import ProfilePage from './pages/ProfilePage';
import MyRidesPage from './pages/MyRidesPage';
import NotificationPage from './pages/NotificationPage';
import { usePWA } from '../App';
import { useToast } from '../context/ToastContext';
import { API_BASE_URL } from '../config/api';
import { requestPermissionAndToken, onForegroundMessage } from '../firebase';

function UserHome() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('search');
  const { handleInstall, showInstall, isInstalled } = usePWA();
  const [showBanner, setShowBanner] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { showToast } = useToast();

  // Sync activeTab from location state (for returns from MapPicker)
  useEffect(() => {
    if (location.state && location.state.activeTab) {
      setActiveTab(location.state.activeTab);
    }
  }, [location.state]);

  // Handle PWA Banner side-effects
  useEffect(() => {
    const isDismissed = localStorage.getItem('pwa_banner_dismissed');
    if (!isDismissed && showInstall && !isInstalled) {
      setShowBanner(true);
    } else {
      setShowBanner(false);
    }
  }, [showInstall, isInstalled]);

  // Poll for unread notification count
  const fetchUnread = useCallback(async () => {
    const userId = localStorage.getItem('userId');
    if (!userId) return;
    try {
      const url = `${API_BASE_URL}/api/notifications/unread-count/${userId}`;
      console.log("API CALL:", url, 'GET');
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) setUnreadCount(data.count);
    } catch (e) { /* silent */ }
  }, []);

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => clearInterval(interval);
  }, [activeTab, fetchUnread]);

  // Firebase Push Notifications — request permission + save token + foreground handler
  useEffect(() => {
    const setupPush = async () => {
      const userId = localStorage.getItem('userId');
      if (!userId) return;

      console.log('[Push] Initializing push setup...');
      
      try {
        const token = await requestPermissionAndToken();
        if (token) {
          const url = `${API_BASE_URL}/api/save-fcm-token`;
          console.log("API CALL:", url, 'POST');
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, token })
          });
          const data = await response.json();
          if (data.success) {
            console.log('[Push] FCM token successfully saved to backend');
            localStorage.setItem('fcm_token_saved', 'true');
          } else {
            console.error('[Push] Backend failed to save token:', data.message);
          }
        } else {
          console.warn('[Push] No token received (Permission denied or dismissed)');
        }
      } catch (err) {
        console.error('[Push] Error in setupPush:', err);
      }
    };

    setupPush();

    // Handle foreground messages — show as toasts + bump unread count
    const unsubscribe = onForegroundMessage((payload) => {
      console.log('[Push] Foreground message payload:', payload);
      const title = payload.notification?.title || payload.data?.title || 'New Notification';
      const body = payload.notification?.body || payload.data?.body || 'You have a new alert';
      
      // 1. Show Toast
      showToast(`${title}: ${body}`, 'success');
      
      // 2. Update Notification State (bump count)
      setUnreadCount(prev => prev + 1);
      
      // 3. Optional: Trigger a slight vibration for better user experience
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
    });

    return () => {
      console.log('[Push] Cleaning up push listeners');
      if (unsubscribe) unsubscribe();
    };
  }, [showToast]);

  const dismissBanner = () => {
    localStorage.setItem('pwa_banner_dismissed', 'true');
    setShowBanner(false);
  };

  const renderContent = () => {

    switch (activeTab) {
      case 'search': return <SearchPage />;
      case 'post': return <PostPage />;
      case 'message': return <MessagePage />;
      case 'my-rides': return <MyRidesPage />;
      case 'profile': return <ProfilePage />;
      case 'notifications': return <NotificationPage />;
      default: return <SearchPage />;
    }
  };

  const menuItems = [
    { key: 'search', label: 'Search', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    )},
    { key: 'post', label: 'Offer', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    )},
    { key: 'my-rides', label: 'My Rides', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )},
    { key: 'message', label: 'Chat', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    )},
    { key: 'profile', label: 'Account', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    )}
  ];

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* ── Top Header ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h1 className="text-xl font-black tracking-tighter text-black">
              RIDE<span className="text-gray-300 font-medium">MATE</span>
            </h1>
            
            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1">
              {menuItems.slice(0, 2).map((item) => (
                <button
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all
                    ${activeTab === item.key 
                      ? 'bg-black text-white' 
                      : 'text-gray-400 hover:text-black hover:bg-gray-50'}`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {/* PWA Install Button */}
            {showInstall && !isInstalled && (
              <button 
                onClick={handleInstall}
                title="Install App"
                className="p-2 text-black hover:opacity-50 transition-all flex items-center justify-center animate-pulse"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
            )}

             {/* Notification Dot */}

             <button
              onClick={() => { setActiveTab('notifications'); setUnreadCount(0); }}
              className="relative p-2 text-gray-400 hover:text-black transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-black text-white text-[8px] font-black rounded-full flex items-center justify-center ring-2 ring-white px-1">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* Account Trigger */}
            <button 
              onClick={() => setActiveTab('profile')}
              className={`w-9 h-9 border rounded-full flex items-center justify-center text-xs font-bold transition-all
                ${activeTab === 'profile' 
                  ? 'border-black bg-black text-white' 
                  : 'border-gray-100 text-gray-400 hover:border-black hover:text-black'}`}
            >
              A
            </button>
          </div>
        </div>
      </header>


      {/* ── Content View ── */}
      <main className="pt-16">
        {showBanner && (
          <div className="bg-black text-white px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in slide-in-from-top-full duration-500 sticky top-16 z-40">
            <div className="flex items-center gap-3">
              <span className="text-xl">📱</span>
              <p className="text-[10px] font-black uppercase tracking-widest text-center sm:text-left">
                Install RideMate for a better experience
              </p>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button 
                onClick={handleInstall}
                className="flex-1 sm:flex-none bg-white text-black px-6 py-2 rounded-full text-[9px] font-black uppercase tracking-widest hover:bg-gray-200 transition-colors"
              >
                Install
              </button>
              <button 
                onClick={dismissBanner}
                className="flex-1 sm:flex-none bg-transparent border border-gray-700 text-gray-400 px-6 py-2 rounded-full text-[9px] font-black uppercase tracking-widest hover:text-white hover:border-white transition-colors"
              >
                Not Now
              </button>
            </div>
          </div>
        )}
        {renderContent()}
      </main>


      {/* ── Custom Minimal Bottom Nav ── */}
      <footer className="fixed bottom-0 left-0 w-full z-50 bg-white border-t border-gray-200 flex justify-around items-center h-16">
        {menuItems.map((item) => {
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key)}
              className="flex flex-col items-center justify-center gap-1 group transition-all px-2"
            >
              <div className={`transition-colors ${isActive ? 'text-black' : 'text-gray-500 group-hover:text-black'}`}>
                {item.icon}
              </div>
              <span className={`text-[10px] uppercase tracking-wider transition-colors
                ${isActive ? 'text-black font-semibold' : 'text-gray-500 group-hover:text-black'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </footer>
    </div>
  );
}

export default UserHome;
