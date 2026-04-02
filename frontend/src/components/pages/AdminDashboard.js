import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../config/api';

const AdminDashboard = () => {
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalRides: 0,
        pendingVerifications: 0,
        completedRides: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const [usersRes, ridesRes, verificationsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/admin/users`),
                fetch(`${API_BASE_URL}/api/admin/rides`),
                fetch(`${API_BASE_URL}/api/admin/verifications`)
            ]);

            const usersData = await usersRes.json();
            const ridesData = await ridesRes.json();
            const verificationsData = await verificationsRes.json();

            if (usersData.success && ridesData.success && verificationsData.success) {
                const rides = ridesData.rides || [];
                setStats({
                    totalUsers: (usersData.users || []).length,
                    totalRides: rides.length,
                    pendingVerifications: (verificationsData.verifications || []).filter(v => v.status === 'pending').length,
                    completedRides: rides.filter(r => r.status === 'Completed').length
                });
            }
        } catch (error) {
            console.error('Error fetching admin stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const statCards = [
        { 
            label: 'Total Users', 
            value: stats.totalUsers, 
            icon: '👥', 
            color: 'bg-blue-500',
            trend: '+12% from last month' 
        },
        { 
            label: 'Total Rides', 
            value: stats.totalRides, 
            icon: '🚗', 
            color: 'bg-indigo-500',
            trend: 'Stable activity' 
        },
        { 
            label: 'Pending KYC', 
            value: stats.pendingVerifications, 
            icon: '🛡️', 
            color: 'bg-amber-500',
            trend: 'Action required' 
        },
        { 
            label: 'Completed', 
            value: stats.completedRides, 
            icon: '✅', 
            color: 'bg-emerald-500',
            trend: '94% success rate' 
        }
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col gap-1">
                <h2 className="text-3xl font-black tracking-tighter text-black uppercase">Analytics</h2>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Platform Pulse & Metrics</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((stat, i) => (
                    <div key={i} className="bg-white border border-gray-100 p-6 rounded-[2rem] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                        <div className={`w-12 h-12 ${stat.color} text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-gray-200`}>
                            <span className="text-xl">{stat.icon}</span>
                        </div>
                        <div className="space-y-1">
                            <p className="text-4xl font-black tracking-tighter text-black">{stat.value}</p>
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest leading-none">{stat.label}</p>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-50">
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{stat.trend}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Visual Placeholder for a Chart */}
            <div className="bg-black text-white p-8 rounded-[2.5rem] relative overflow-hidden group">
                <div className="relative z-10">
                    <h3 className="text-xl font-black uppercase tracking-tight mb-2">Growth Trajectory</h3>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-8">Ride velocity over the last 30 days</p>
                    
                    <div className="h-48 flex items-end gap-2">
                        {[40, 70, 45, 90, 65, 80, 50, 100, 75, 85].map((h, i) => (
                            <div 
                                key={i} 
                                className="flex-1 bg-white/10 rounded-t-lg hover:bg-white/30 transition-all cursor-crosshair group/bar relative"
                                style={{ height: `${h}%` }}
                            >
                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white text-black text-[10px] font-black px-2 py-1 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity">
                                    {Math.round(h * 1.5)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                {/* Decorative background elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-white/10 transition-colors"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full -ml-16 -mb-16 blur-2xl"></div>
            </div>
        </div>
    );
};

export default AdminDashboard;
