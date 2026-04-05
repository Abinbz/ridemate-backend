import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config/api';

const AdminRideDetailsPage = () => {
    const { id } = useParams();
    const [ride, setRide] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchRideDetails();
    }, [id]);

    const fetchRideDetails = async () => {
        try {
            const url = `${API_BASE_URL}/api/admin/ride/${id}`;
            console.log("API CALL:", url, 'GET');
            const response = await fetch(url);
            const data = await response.json();
            if (data.success) {
                setRide(data.ride);
            }
        } catch (error) {
            console.error('Error fetching ride details:', error);
            // Silent error for admin UI but log it
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!ride) {
        return (
            <div className="p-6 text-center">
                <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Intercept Missing</p>
                <button onClick={() => navigate('/admin/rides')} className="mt-4 px-6 py-3 bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-gray-200">Return to Monitor</button>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-8 animate-in slide-in-from-left-4 duration-500 pb-24">
            <button onClick={() => navigate('/admin/rides')} className="flex items-center gap-2 group">
                 <div className="w-8 h-8 rounded-full border border-gray-100 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                 </div>
                 <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 group-hover:text-black transition-colors">Abort & Return</span>
            </button>

            <div className="flex flex-col gap-1">
                <h2 className="text-3xl font-black tracking-tighter text-black uppercase">Deep Scan</h2>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Intelligence Report • ID: {id.slice(-6).toUpperCase()}</p>
            </div>

            <div className="bg-black text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                 <div className="relative z-10 flex flex-col items-center gap-6">
                    <div className="w-20 h-20 bg-white/10 rounded-3xl border border-white/20 flex items-center justify-center text-3xl shadow-xl transition-transform group-hover:scale-110 duration-500">
                        🏎️
                    </div>
                    <div className="text-center space-y-1">
                        <h3 className="text-2xl font-black uppercase tracking-tighter">{ride.driverName}</h3>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Primary Operator</p>
                    </div>
                    <div className="grid grid-cols-2 gap-8 w-full mt-4">
                        <div className="text-right space-y-0.5">
                            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Vessel</p>
                            <p className="text-xs font-bold text-white uppercase truncate">{ride.vehicleName || 'Interceptor'}</p>
                        </div>
                        <div className="text-left space-y-0.5">
                            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Callsign</p>
                            <p className="text-xs font-bold text-white uppercase truncate">{ride.vehicleType || 'Unit'}</p>
                        </div>
                    </div>
                 </div>
                 {/* Decorative background scanline */}
                 <div className="absolute top-0 left-0 w-full h-1 bg-white/5 animate-pulse"></div>
                 <div className="absolute top-1/2 left-0 w-full h-px bg-white/5 -translate-y-1/2"></div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                 <div className="bg-white border border-gray-100 p-8 rounded-[2.5rem] shadow-sm relative overflow-hidden group hover:border-black transition-all">
                    <div className="space-y-6">
                        <div className="flex items-start gap-4">
                            <div className="w-2 h-2 rounded-full bg-black mt-1.5 shadow-lg shadow-black"></div>
                            <div className="flex-1 space-y-0.5">
                                <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest">Entry Point</p>
                                <p className="text-[13px] font-black text-black leading-tight">{ride.from || ride.fromLocation}</p>
                            </div>
                        </div>
                        <div className="h-10 w-px bg-gray-100 ml-1"></div>
                        <div className="flex items-start gap-4">
                            <div className="w-2 h-2 rounded-full border-2 border-black mt-1.5 bg-white"></div>
                            <div className="flex-1 space-y-0.5">
                                <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest">Extraction Zone</p>
                                <p className="text-[13px] font-black text-black leading-tight">{ride.to || ride.toLocation}</p>
                            </div>
                        </div>
                    </div>
                    <div className="absolute top-8 right-8 text-right space-y-1">
                        <p className="text-[10px] font-black text-black leading-none uppercase tracking-tighter">₹{ride.price || '0'}</p>
                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest leading-none">Exchange Value</p>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-black uppercase tracking-widest px-1">Manifest Pool</h4>
                    {(ride.passengers || []).length > 0 ? (
                        (ride.passengers || []).map((passenger, i) => (
                            <div key={passenger.userId || i} className="bg-gray-50/50 border border-transparent hover:border-gray-100 hover:bg-white p-5 rounded-3xl flex items-center justify-between gap-4 transition-all group">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-black text-white rounded-2xl flex items-center justify-center text-xs font-black">
                                        {(passenger.name || 'P')[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-xs font-black text-black leading-none uppercase tracking-tight">
                                                {passenger.name} - {passenger.collegeId} - {passenger.status}
                                            </p>
                                        </div>
                                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                                            ID: {(passenger.userId || passenger.user || '...').slice(-6).toUpperCase()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="py-12 border-2 border-dashed border-gray-100 rounded-[2rem] text-center">
                            <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest leading-none">No Confirmed Targets</p>
                        </div>
                    )}
                 </div>

                 {ride.status === 'Completed' && ride.ratings && ride.ratings.length > 0 && (
                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-black uppercase tracking-widest px-1">Post-Op Debrief</h4>
                        {ride.ratings.map((rating, i) => (
                            <div key={i} className="bg-white border border-gray-100 p-6 rounded-[2rem] shadow-sm relative group overflow-hidden">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-1">
                                        {[...Array(5)].map((_, j) => (
                                            <span key={j} className={`text-xs ${j < rating.rating ? 'text-black' : 'text-gray-200'}`}>⭐</span>
                                        ))}
                                    </div>
                                    <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest">Validated Entry</p>
                                </div>
                                <p className="text-xs font-bold text-black uppercase leading-relaxed tracking-tight">&quot;{rating.comment || 'Performance within parameters.'}&quot;</p>
                                <div className="absolute bottom-0 right-0 w-24 h-24 bg-black/[0.02] rounded-full -mr-12 -mb-12 blur-2xl"></div>
                            </div>
                        ))}
                    </div>
                 )}
            </div>
        </div>
    );
};

export default AdminRideDetailsPage;
