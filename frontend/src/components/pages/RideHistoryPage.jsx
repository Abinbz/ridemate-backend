import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../shared/LoadingSpinner';
import { API_BASE_URL } from '../../config/api';


const RideCard = ({ ride, onClick }) => (
  <div
    onClick={onClick}
    className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-4 hover:border-black transition-all cursor-pointer group active:scale-[0.98]"
  >
    {/* Top Row: Status & Role */}
    <div className="flex items-center justify-between">
      <span className="bg-green-50 text-green-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-green-100 group-hover:bg-black group-hover:text-white group-hover:border-black transition-colors">
        {ride.status}
      </span>
      <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">
        {ride.role}
      </span>
    </div>

    {/* Route & Price */}
    <div className="flex items-end justify-between gap-4">
      <div className="space-y-1">
        <h3 className="text-sm font-black text-black leading-tight">
          {ride.from} <span className="text-gray-300 px-1">→</span> {ride.to}
        </h3>
        <p className="text-[11px] font-bold text-gray-400">
          {ride.date} • {ride.time || ride.start || ''}
        </p>
      </div>
      <p className="text-lg font-black text-black leading-none">
        {ride.price}
      </p>
    </div>

    {/* Participation Summary (NEW) */}
    <div className="bg-gray-50/50 rounded-2xl p-4 flex items-center justify-between border border-gray-100">
      <div className="flex items-center gap-2">
        <span className="text-[10px]">👥</span>
        <p className="text-[9px] font-black text-black uppercase tracking-widest">
          {ride.passengers?.length || 0} Passengers
        </p>
      </div>
      <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">
        {ride.passengers?.filter(p => p.joined).length || 0} Joined
      </p>
    </div>

    {/* Vehicle Info */}
    <div className="pt-2 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-black rounded-xl flex items-center justify-center text-[10px] font-black text-white">
          {(ride.vehicle || ride.vehicleType || 'V').split(' ')[0][0]}
        </div>
        <p className="text-[10px] font-black text-black uppercase tracking-widest">
          {ride.vehicle}
        </p>
      </div>
      <div className="text-gray-200">
        &rarr;
      </div>
    </div>
  </div>
);

function RideHistoryPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('posted');
  const [history, setHistory] = useState({ posted: [], booked: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      const userId = localStorage.getItem('userId');
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        console.log("API CALL:", `${API_BASE_URL}/api/ride-history?userId=${userId}`);
        const response = await fetch(`${API_BASE_URL}/api/ride-history?userId=${userId}`);
        const data = await response.json();
        console.log("Ride history response:", data);

        if (response.ok && data.success) {
          setHistory({
            posted: data.posted || [],
            booked: data.booked || []
          });
        }
      } catch (err) {
        console.error('Fetch history error:', err);
        // Silent error for history but log it properly in production
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const currentRides = history[activeTab];

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header */}
      <div className="px-6 py-8 border-b border-gray-50 flex items-center gap-4 sticky top-0 bg-white z-50">
        <button onClick={() => navigate(-1)} className="text-black hover:opacity-50 transition-opacity">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-black text-black">Ride History</h1>
      </div>

      <div className="max-w-md mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex border-b border-gray-100 mb-8 sticky top-24 bg-white z-10 transition-all">
          {['posted', 'booked'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === tab ? 'text-black' : 'text-gray-300'
                }`}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 w-full h-[2px] bg-black animate-in fade-in duration-300"></div>
              )}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="space-y-6">

            {currentRides.length > 0 ? (
              currentRides.map((ride) => (
                <RideCard
                  key={ride.id}
                  ride={ride}
                  onClick={() => navigate('/user/my-rides/details', { state: { ride } })}
                />
              ))
            ) : (
              <div className="bg-gray-50 border border-dashed border-gray-200 rounded-[2.5rem] py-20 flex flex-col items-center justify-center text-center px-8">
                <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-gray-200 text-2xl mb-6 shadow-sm">○</div>
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">No completed rides yet</p>
                <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mt-2 italic">Your finished journeys will appear here</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default RideHistoryPage;
