import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../shared/LoadingSpinner';
import { API_BASE_URL } from '../../config/api';
import { showNotification } from '../../utils/notifications';

const RideCard = ({ ride, onClick, onJoin, activeTab }) => {
  const userId = localStorage.getItem('userId');
  const isPassenger = activeTab === 'booked';
  const showJoinButton = isPassenger && 
                        ride.status === 'ongoing' && 
                        (ride.passengers || []).find(p => String(p.userId || p.user) === String(userId))?.status === 'booked';

  return (
    <div
      onClick={onClick}
      className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm space-y-4 hover:border-black transition-all cursor-pointer group active:scale-[0.98]"
    >
      {/* Top Row: Status & Role */}
      <div className="flex items-center justify-between">
        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-colors ${
          ride.status === 'ongoing' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-gray-50 text-black border-gray-100'
        }`}>
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

      {/* Vehicle Info */}
      <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-50 rounded-xl flex items-center justify-center text-[10px] font-black text-black">
            {(ride.vehicle || ride.vehicleType || 'V').split(' ')[0][0]}
          </div>
          <p className="text-[10px] font-black text-black uppercase tracking-widest">
            {ride.vehicle || `${ride.vehicleType} (${ride.vehicleName})`}
          </p>
        </div>
        
        {showJoinButton ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onJoin(ride.id || ride._id);
            }}
            className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 active:scale-95 transition-all shadow-lg shadow-emerald-500/20"
          >
            Join Ride
          </button>
        ) : (
          <div className="text-gray-200">
            &rarr;
          </div>
        )}
      </div>
    </div>
  );
};

function MyRidesPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('posted');
  const [rides, setRides] = useState({
    posted: { upcoming: [], ongoing: [], completed: [] },
    booked: { upcoming: [], ongoing: [], completed: [] }
  });
  const [loading, setLoading] = useState(true);
  const sections = ['Upcoming', 'Ongoing', 'Completed'];

  const fetchMyRides = async () => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      console.log("API CALL:", `${API_BASE_URL}/api/my-rides/${userId}`);
      const response = await fetch(`${API_BASE_URL}/api/my-rides/${userId}`);
      const data = await response.json();
      console.log('My Rides API response:', data);

      if (response.ok && data.success) {
        setRides({
          posted: data.posted || [],
          booked: data.booked || []
        });
      }
    } catch (err) {
      console.error('Fetch My Rides error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyRides();
  }, []);

  const handleJoinRide = async (rideId) => {
    const userId = localStorage.getItem('userId');
    try {
      const response = await fetch(`${API_BASE_URL}/api/join-ride`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, rideId })
      });
      const data = await response.json();
      if (data.success) {
        showNotification("Passenger Joined 👤", `You have successfully joined the ride to ${ride.toLocation || ride.to}`);
        // Refresh the list to show "Joined" or update status
        await fetchMyRides();
      } else {
        alert(data.message || "Failed to join ride");
      }
    } catch (err) {
      console.error("Join ride error:", err);
    }
  };

  const getRidesForSection = (section) => {
    const key = section.toLowerCase();
    const tabData = rides[activeTab];
    return tabData[key] || [];
  };

  const totalRidesInTab = () => {
    const tabData = rides[activeTab];
    return tabData.length || 0;
  };

  return (
    <div className="max-w-md mx-auto px-4 py-4 min-h-screen bg-white pb-24">
      <h1 className="text-xl font-black text-black mb-6">My Rides</h1>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 mb-8 sticky top-16 bg-white z-10 transition-all">
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
        /* Sections */

        <div className="space-y-12">
          {totalRidesInTab() === 0 ? (
            <div className="text-center py-24 bg-gray-50 rounded-[3rem] border border-dashed border-gray-200 animate-in fade-in zoom-in-95 duration-500">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm text-2xl">
                {activeTab === 'posted' ? '📢' : '🎟️'}
              </div>
              <h3 className="text-sm font-black text-black uppercase tracking-widest mb-2">No rides yet</h3>
              <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest max-w-[200px] mx-auto leading-relaxed mb-8">
                {activeTab === 'posted' ? "Offer your first ride to share your journey with others." : "You haven't booked any rides yet."}
              </p>
              <button
                onClick={() => navigate('/user/home')}
                className="bg-black text-white px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-900 active:scale-95 transition-all shadow-lg shadow-black/5"
              >
                {activeTab === 'posted' ? 'Offer a Ride' : 'Find a Ride'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {rides[activeTab].map((ride) => (
                <RideCard
                  key={ride.id || ride._id}
                  ride={ride}
                  activeTab={activeTab}
                  onJoin={handleJoinRide}
                  onClick={() => navigate('/user/my-rides/details', { state: { ride } })}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MyRidesPage;
