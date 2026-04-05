import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config/api';
import LoadingSpinner from '../shared/LoadingSpinner';

const NOTIF_ICONS = {
  message: '💬',
  booking: '🎟️',
  cancel: '✕',
  rating: '⭐',
  ride_update: '🚗',
  document: '📄',
};

function NotificationPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
    
    // 10s Polling for secondary alerts
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    const userId = localStorage.getItem('userId');
    if (!userId) return;

    try {
      const url = `${API_BASE_URL}/api/notifications?userId=${userId}`;
      console.log("API CALL:", url, 'GET');
      const response = await fetch(url);
      const data = await response.json();
      if (response.ok && data.success) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAllRead = async () => {
    const userId = localStorage.getItem('userId');
    if (!userId) return;

    try {
      const url = `${API_BASE_URL}/api/notifications/read`;
      console.log("API CALL:", url, 'PUT');
      await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark notifications:', err);
    }
  };

  const handleNotificationClick = async (notif) => {
    // Mark single as read
    const userId = localStorage.getItem('userId');
    if (!notif.isRead) {
      try {
        const url = `${API_BASE_URL}/api/notifications/mark-read`;
        console.log("API CALL:", url, 'POST');
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, notificationId: notif.id })
        });
        setNotifications(prev =>
          prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (err) {
        console.error(err);
      }
    }

    // Navigate based on type
    if (notif.type === 'message' && notif.fromId) {
      navigate('/chat', { state: { receiverId: notif.fromId, receiverName: '' } });
    } else if (notif.type === 'booking' || notif.type === 'ride_update') {
      navigate('/user/my-rides');
    }
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-4 min-h-screen bg-white pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-black text-black">Notifications</h1>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-[10px] font-black text-black uppercase tracking-widest border-b border-black pb-0.5 hover:opacity-50 transition-opacity"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Unread count */}
      {unreadCount > 0 && (
        <div className="mb-6 px-4 py-2 bg-black text-white rounded-full inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
          {unreadCount} unread
        </div>
      )}

      {/* Notification List */}
      {notifications.length === 0 ? (
        <div className="text-center py-24 bg-gray-50 rounded-[3rem] border border-dashed border-gray-200">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm text-2xl">
            🔔
          </div>
          <h3 className="text-sm font-black text-black uppercase tracking-widest mb-2">All clear</h3>
          <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest max-w-[200px] mx-auto leading-relaxed">
            No notifications yet. They&apos;ll appear here when something happens.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              className={`flex items-start gap-4 p-5 rounded-2xl cursor-pointer transition-all active:scale-[0.98] ${
                notif.isRead
                  ? 'bg-white hover:bg-gray-50'
                  : 'bg-gray-50 border border-gray-100 shadow-sm'
              }`}
            >
              {/* Icon */}
              <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-sm ${
                notif.isRead ? 'bg-gray-100' : 'bg-black text-white'
              }`}>
                {notif.isRead ? NOTIF_ICONS[notif.type] || '🔔' : NOTIF_ICONS[notif.type] || '🔔'}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className={`text-[11px] font-black uppercase tracking-widest ${
                    notif.isRead ? 'text-gray-400' : 'text-black'
                  }`}>
                    {notif.title || notif.type}
                  </p>
                  {!notif.isRead && (
                    <span className="w-1.5 h-1.5 bg-black rounded-full flex-shrink-0"></span>
                  )}
                </div>
                <p className={`text-[11px] leading-relaxed truncate ${
                  notif.isRead ? 'text-gray-300 font-bold' : 'text-gray-600 font-bold'
                }`}>
                  {notif.message || notif.text || ''}
                </p>
                <p className="text-[9px] font-bold text-gray-200 uppercase tracking-widest mt-2">
                  {formatTime(notif.createdAt || notif.timestamp)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default NotificationPage;
