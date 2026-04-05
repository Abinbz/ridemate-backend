import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { API_BASE_URL } from '../../config/api';

function RideDetailsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const { ride } = location.state || {};
  const [userData, setUserData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const userId = localStorage.getItem('userId');

  // Helper: Find user status in manifest
  const currentUserId = localStorage.getItem('userId');
  const passengerRecord = ride?.passengers?.find(p => 
    String(p.userId || p.user) === String(currentUserId)
  );
  const isBooked = !!passengerRecord;
  const isJoined = passengerRecord?.status === 'joined' || passengerRecord?.joined === true;
  const isDriver = (ride.createdBy || ride.driverId) === userId;
  const isBanned = userData?.isBanned;
  const rideStatus = ride.status?.toLowerCase();

  const handleBooking = async () => {
    if (!userId) {
      showToast('Please log in to book a ride.', 'error');
      navigate('/');
      return;
    }
    if (isBanned) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/book-ride`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, rideId: ride.id || ride._id })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Seat reserved successfully!', 'success');
        navigate('/user/my-rides');
      } else {
        showToast(data.message || 'Booking failed', 'error');
      }
    } catch (err) {
      showToast('Connection error', 'error');
    } finally { setIsProcessing(false); }
  };

  const handleCheckIn = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/join-ride`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, rideId: ride.id || ride._id })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Welcome aboard!', 'success');
        navigate('/user/my-rides');
      } else {
        showToast(data.message, 'error');
      }
    } catch (err) {
      showToast('Server error', 'error');
    } finally { setIsProcessing(false); }
  };

  const handleMessage = () => {
    const driverId = ride.createdBy || ride.driverId;
    const driverName = (typeof ride.driver === 'object' && ride.driver) ? ride.driver.name : (typeof ride.driver === 'string' ? ride.driver : "Strategic Driver");
    if (!driverId) return;
    navigate('/chat', { state: { receiverId: driverId, receiverName: driverName } });
  };

  // Button Logic Mapping
  let buttonLabel = "Join Ride";
  let buttonAction = null;
  let disabled = false;

  if (isDriver) {
    buttonLabel = "Manage My Ride";
    buttonAction = () => navigate('/user/my-rides/details', { state: { ride } });
  } else if (rideStatus === 'completed') {
    buttonLabel = "Ride Completed";
    disabled = true;
  } else if (rideStatus === 'ongoing') {
    if (isJoined) {
      buttonLabel = "Already Onboard";
      disabled = true;
    } else if (isBooked) {
      buttonLabel = "Join Ride Now";
      buttonAction = handleCheckIn;
    } else {
      buttonLabel = "Ride In Progress";
      disabled = true;
    }
  } else if (rideStatus === 'upcoming') {
    if (isBooked) {
      buttonLabel = "Seat Reserved";
      disabled = true;
    } else {
      buttonLabel = "Book Seat";
      buttonAction = handleBooking;
    }
  }

  return (
    <div className="min-h-screen bg-white pb-32">
      {/* ── Sticky Header ── */}
      <div className="bg-white border-b border-gray-50 px-6 py-6 flex items-center gap-4 sticky top-0 z-50">
        <button onClick={() => navigate(-1)} className="text-black hover:opacity-50 transition-opacity">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex flex-col">
          <h1 className="text-sm font-black text-black uppercase tracking-widest leading-none">Ride Details</h1>
          <span className={`text-[8px] font-black uppercase tracking-widest mt-0.5 ${
            rideStatus === 'ongoing' ? 'text-emerald-500' : rideStatus === 'completed' ? 'text-gray-300' : 'text-amber-500'
          }`}>
            {rideStatus?.toUpperCase() || "UPCOMING"}
          </span>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-6 py-10 space-y-12">

        {/* ── Driver Profile ── */}
        <section className="flex flex-col items-center text-center">
          <div className="w-24 h-24 bg-black text-white rounded-[2rem] flex items-center justify-center text-3xl font-black mb-6 shadow-sm overflow-hidden">
            {ride?.driver?.avatar ? (
              <img src={ride.driver.avatar} alt="driver" className="w-full h-full object-cover" />
            ) : (
              <span>
                {(ride?.driver?.name || ride?.driver?.username || (typeof ride?.driver === 'string' ? ride.driver : 'D'))[0]?.toUpperCase()}
              </span>
            )}
          </div>
          <h2 className="text-2xl font-black text-black leading-none mb-2">
            {ride?.driver?.name || ride?.driver?.username || (typeof ride?.driver === 'string' ? ride.driver : "Strategic Driver")}
          </h2>
          <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-50 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-black" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 .587l3.668 7.568 8.332 1.151-6.064 5.828 1.48 8.279-7.416-3.967-7.417 3.967 1.481-8.279-6.064-5.828 8.332-1.151z" />
            </svg>
            <span className="text-[10px] font-black text-black uppercase tracking-widest">
              {ride?.driver?.rating || ride?.rating || '5.0'} Rating
            </span>
          </div>
        </section>

        {/* ── Vehicle Info ── */}
        <section className="border border-gray-100 rounded-[2.5rem] p-8 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1">Vehicle</p>
            <p className="text-sm font-black text-black">{ride?.vehicleName || "Assigned Vehicle"}</p>
          </div>
          <div className="text-right">
            <span className="inline-block px-4 py-1 bg-black text-white text-[9px] font-black uppercase tracking-widest rounded-full">
              {ride?.vehicleType || "T1"}
            </span>
            <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mt-2">Verified</p>
          </div>
        </section>

        {/* ── Journey Timeline ── */}
        <section className="space-y-8">
          <h3 className="text-[10px] font-black text-black uppercase tracking-widest border-b border-gray-50 pb-2">The Journey</h3>
          <div className="flex gap-6">
            <div className="flex flex-col items-center py-1">
              <div className="w-2.5 h-2.5 rounded-full bg-black"></div>
              <div className="flex-1 w-px border-l-2 border-dashed border-gray-100 my-2"></div>
              <div className="w-2.5 h-2.5 rounded-full border-2 border-black bg-white"></div>
            </div>
            <div className="flex-1 space-y-12">
              <div>
                <div className="flex justify-between items-baseline mb-1">
                  <p className="text-sm font-black text-black truncate pr-4">{ride?.from || "Source"}</p>
                  <p className="text-sm font-black text-black shrink-0">{ride?.start || "00:00"}</p>
                </div>
                <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest italic">Pickup Point</p>
              </div>
              <div>
                <div className="flex justify-between items-baseline mb-1">
                  <p className="text-sm font-black text-black truncate pr-4">{ride?.to || "Destination"}</p>
                  <p className="text-sm font-black text-black shrink-0">{ride?.end || "00:00"}</p>
                </div>
                <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest italic">Destination</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Passenger Manifest ── */}
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-gray-50 pb-2">
            <h3 className="text-[10px] font-black text-black uppercase tracking-widest">Passenger Manifest</h3>
            <span className="text-[8px] font-black text-gray-300 uppercase tracking-widest">{ride.passengers?.length || 0} Joined</span>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            {(ride.passengers || []).length > 0 ? (
              ride.passengers.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between bg-gray-50/50 p-4 rounded-2xl border border-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-[9px] font-black text-white">
                      {(p.name || 'P')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-black uppercase tracking-tight">{p.name || "Passenger"}</p>
                      <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">{p.collegeId || 'ID Verified'}</p>
                    </div>
                  </div>
                  <span className={`text-[7px] font-black uppercase px-3 py-1 rounded-full border ${
                    p.status === 'joined' || p.joined ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-white text-gray-300 border-gray-100'
                  }`}>
                    {p.status === 'joined' || p.joined ? 'Boarded' : 'Reserved'}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest text-center py-4 italic">No passengers yet.</p>
            )}
          </div>
        </section>

        {/* ── Price Card ── */}
        <section className="bg-black text-white p-10 rounded-[2.5rem] flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 leading-none">Total Fare</p>
            <h4 className="text-4xl font-black leading-none italic uppercase">
              ₹{ride?.price?.toString() || "0"}
            </h4>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Safe & Secure</p>
            <p className="text-[9px] font-black text-white uppercase tracking-widest">UPI / Cash / Card</p>
          </div>
        </section>

      </div>

      {/* ── Fixed Footer Actions ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-50 p-6 flex gap-4 z-50">
        <button
          onClick={handleMessage}
          className="flex-1 py-5 border border-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-all text-black"
        >
          Message
        </button>
        <button
          onClick={buttonAction}
          disabled={disabled || isProcessing || isBanned}
          className={`flex-[1.5] py-5 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-[0.98] transition-all
            ${disabled || isProcessing || isBanned ? 'bg-gray-300 cursor-not-allowed' : 'bg-black hover:bg-gray-900'}`}
        >
          {isProcessing ? 'Processing...' : isBanned ? 'Restricted' : buttonLabel}
        </button>
      </div>
    </div>
  );
}

export default RideDetailsPage;
