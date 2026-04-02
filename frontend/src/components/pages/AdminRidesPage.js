import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config/api';

const AdminRidesPage = () => {
    const [rides, setRides] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchRides();
    }, []);

    const fetchRides = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/rides`);
            const data = await response.json();
            if (data.success) {
                setRides(data.rides || []);
            }
        } catch (error) {
            console.error('Error fetching admin rides:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'Completed': return 'bg-emerald-500 text-white';
            case 'Ongoing': return 'bg-blue-500 text-white';
            case 'Scheduled': return 'bg-amber-500 text-white';
            case 'Cancelled': return 'bg-red-500 text-white';
            default: return 'bg-gray-100 text-gray-400';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-black tracking-tighter text-black uppercase">Fleet Monitor</h2>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Live Logistics Overview</p>
            </div>

            <div className="space-y-4">
                {rides.length > 0 ? (
                    rides.map((ride) => (
                        <div 
                            key={ride.id} 
                            onClick={() => navigate(`/admin/ride/${ride.id}`)}
                            className="bg-white border border-gray-100 p-6 rounded-[2.5rem] shadow-sm hover:shadow-xl hover:border-black transition-all cursor-pointer group"
                        >
                            <div className="flex justify-between items-start mb-6">
                                <div className="space-y-1">
                                    <h3 className="text-sm font-black text-black leading-tight uppercase tracking-tight">{ride.driverName || 'Anonymous Driver'}</h3>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none">Fleet Commander</p>
                                </div>
                                <span className={`text-[8px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-sm shadow-gray-200 ${getStatusStyle(ride.status)}`}>
                                    {ride.status || 'Scheduled'}
                                </span>
                            </div>

                            <div className="flex items-center gap-6 mb-6">
                                <div className="flex-1 space-y-1">
                                    <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest leading-none">Origin</p>
                                    <p className="text-[11px] font-bold text-black truncate">{ride.from || ride.fromLocation}</p>
                                </div>
                                <div className="w-8 flex items-center justify-center opacity-20">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                    </svg>
                                </div>
                                <div className="flex-1 space-y-1">
                                    <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest leading-none">Destination</p>
                                    <p className="text-[11px] font-bold text-black truncate">{ride.to || ride.toLocation}</p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-center text-xs shadow-sm">
                                        📅
                                    </div>
                                    <p className="text-[10px] font-bold text-black uppercase tracking-widest">{ride.date || 'TBD'}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex -space-x-2">
                                        {(ride.bookedUsers || []).map((_, i) => (
                                            <div key={i} className="w-7 h-7 rounded-full bg-white border-2 border-white shadow-sm overflow-hidden flex items-center justify-center text-[10px] bg-black text-white font-black">
                                                P
                                            </div>
                                        ))}
                                        { (ride.bookedUsers || []).length === 0 && (
                                            <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">Lone Voyager</p>
                                        )}
                                    </div>
                                    { (ride.bookedUsers || []).length > 0 && (
                                        <p className="text-[9px] font-black text-black ml-1 uppercase tracking-widest">
                                            {(ride.bookedUsers || []).length} Units
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="py-20 text-center border-2 border-dashed border-gray-100 rounded-[2.5rem]">
                        <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Zero Active Interceptors</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminRidesPage;
