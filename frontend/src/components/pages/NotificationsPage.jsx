import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../config/api';

const NotificationsPage = () => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const userId = localStorage.getItem('userId');

    useEffect(() => {
        if (userId) {
            fetchNotifications();
        }
    }, [userId]);

    const fetchNotifications = async () => {
        try {
            // Using standardized GET /api/notifications?userId=...
            const response = await fetch(`${API_BASE_URL}/api/notifications?userId=${userId}`);
            const data = await response.json();
            if (data.success) {
                setNotifications(data.notifications || []);
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    const markAllAsRead = async () => {
        try {
            // Using standardized PUT /api/notifications/read
            const response = await fetch(`${API_BASE_URL}/api/notifications/read`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });
            const data = await response.json();
            if (data.success) {
                setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            }
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    const getIcon = (type) => {
        switch (type) {
            case 'KYC_APPROVED': return '✅';
            case 'KYC_REJECTED': return '❌';
            case 'USER_BANNED': return '🚫';
            case 'ROLE_UPGRADED': return '🏎️';
            case 'RIDE_UPCOMING': return '🤝';
            case 'RIDE_STARTED': return '🚗';
            case 'RIDE_COMPLETED': return '🏁';
            case 'PASSENGER_JOINED': return '🧑‍🤝‍🧑';
            case 'verification': return '🛡️';
            case 'admin-action': return '⚙️';
            default: return '🔔';
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-10 h-10 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Accessing Intelligence Stream...</p>
            </div>
        );
    }

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return (
        <div className="p-6 max-w-2xl mx-auto space-y-8 pb-32">
            <header className="flex justify-between items-end">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black tracking-tighter text-black uppercase leading-none">System Alerts</h1>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em]">Operational Intelligence Feed</p>
                </div>
                {unreadCount > 0 && (
                    <button 
                        onClick={markAllAsRead}
                        className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline"
                    >
                        Mark all as read
                    </button>
                )}
            </header>

            <div className="space-y-4">
                {notifications.length > 0 ? (
                    notifications.map((notif) => (
                        <div 
                            key={notif.id || notif._id}
                            className={`p-6 rounded-[2rem] border transition-all duration-500 ${
                                notif.isRead 
                                ? 'bg-white border-gray-100 opacity-60' 
                                : 'bg-white border-black shadow-xl scale-[1.02]'
                            }`}
                        >
                            <div className="flex gap-5">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm ${
                                    notif.isRead ? 'bg-gray-50' : 'bg-black text-white'
                                }`}>
                                    {getIcon(notif.type)}
                                </div>
                                <div className="space-y-1 flex-1">
                                    <div className="flex justify-between items-start">
                                        <h3 className={`text-xs font-black uppercase tracking-tight ${notif.isRead ? 'text-gray-400' : 'text-black'}`}>
                                            {notif.title || 'System Notification'}
                                        </h3>
                                        {!notif.isRead && (
                                            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                                        )}
                                    </div>
                                    <p className={`text-[10px] font-bold leading-relaxed ${notif.isRead ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {notif.message}
                                    </p>
                                    <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest pt-2">
                                        {new Date(notif.createdAt).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="py-24 text-center border-2 border-dashed border-gray-100 rounded-[3rem] bg-gray-50/50">
                        <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                            📡
                        </div>
                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Signal Clear</h3>
                        <p className="text-[8px] font-bold text-gray-300 uppercase tracking-widest">No strategic updates at this time.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationsPage;
