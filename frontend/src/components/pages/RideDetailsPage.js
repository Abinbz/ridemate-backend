import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { API_BASE_URL } from '../../config/api';

function RideDetailsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const { ride } = location.state || {};
  const [booking, setBooking] = useState(false);

  if (!ride) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 space-y-6">
        <h2 className="text-xl font-black text-black uppercase tracking-tighter">No ride details found</h2>
        <button
          onClick={() => navigate('/user/home')}
          className="bg-black text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-900 transition-all"
        >
          Go Back
        </button>
      </div>
    );
  }

  const handleJoinRide = async () => {
    const userId = localStorage.getItem('userId');
    const rideId = ride.id || ride._id;

    if (!userId) {
      showToast('Please log in to join a ride.', 'error');
      navigate('/');
      return;
    }

    if (ride.status !== 'Scheduled' && ride.status !== 'Upcoming') {
      showToast('This ride has already started or is completed.', 'error');
      return;
    }

    setBooking(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/join-ride`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rideId, userId })
      });
      const data = await response.json();

      if (response.ok && data.success) {
        showToast('Ride joined successfully!', 'success');
        navigate('/user/my-rides');
      } else {
        showToast(data.message || 'Failed to join ride', 'error');
      }
    } catch (err) {
      console.error('Join ride error:', err);
      showToast('Server not reachable. Check backend connection.', 'error');
    } finally {
      setBooking(false);
    }
  };


  const handleMessage = () => {
    if (!ride.driverId && !ride.createdBy) {
      showToast('Contact info not available.', 'error');
      return;
    }
    navigate('/chat', { 
      state: { 
        receiverId: ride.driverId || ride.createdBy, 
        receiverName: ride.driver 
      } 
    });
  };

  const isJoined = ride.bookedUsers?.includes(localStorage.getItem('userId'));
  const isDriver = (ride.driverId || ride.createdBy) === localStorage.getItem('userId');
  const canJoin = (ride.status === 'Scheduled' || ride.status === 'Upcoming') && !isJoined && !isDriver;

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
          <span className="text-[8px] font-black uppercase text-amber-500 tracking-widest mt-0.5">{ride.status}</span>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-6 py-10 space-y-12">

        {/* ── Driver Profile ── */}
        <section className="flex flex-col items-center text-center">
          <div className="w-24 h-24 bg-black text-white rounded-[2rem] flex items-center justify-center text-3xl font-black mb-6 shadow-sm">
            {ride.avatar || ride.driver?.[0]}
          </div>
          <h2 className="text-2xl font-black text-black leading-none mb-2">{ride.driver}</h2>
          <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-50 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-black" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 .587l3.668 7.568 8.332 1.151-6.064 5.828 1.48 8.279-7.416-3.967-7.417 3.967 1.481-8.279-6.064-5.828 8.332-1.151z" />
            </svg>
            <span className="text-[10px] font-black text-black uppercase tracking-widest">{ride.rating} Rating</span>
          </div>
        </section>

        {/* ── Vehicle Info ── */}
        <section className="border border-gray-100 rounded-[2.5rem] p-8 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1">Vehicle</p>
            <p className="text-sm font-black text-black">{ride.vehicleName}</p>
          </div>
          <div className="text-right">
            <span className="inline-block px-4 py-1 bg-black text-white text-[9px] font-black uppercase tracking-widest rounded-full">
              {ride.vehicleType}
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
                  <p className="text-sm font-black text-black truncate pr-4">{ride.from}</p>
                  <p className="text-sm font-black text-black shrink-0">{ride.start}</p>
                </div>
                <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest italic">Pickup Point</p>
              </div>
              <div>
                <div className="flex justify-between items-baseline mb-1">
                  <p className="text-sm font-black text-black truncate pr-4">{ride.to}</p>
                  <p className="text-sm font-black text-black shrink-0">{ride.end}</p>
                </div>
                <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest italic">Destination</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-6 rounded-[2rem] text-center">
            <p className="text-[10px] font-black text-black uppercase tracking-widest">
              Duration: <span className="text-gray-400">{ride.duration}</span> | Capacity: <span className="text-gray-400">{ride.passengers} Seats</span>
            </p>
          </div>
        </section>

        {/* ── Price Card ── */}
        <section className="bg-black text-white p-10 rounded-[2.5rem] flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 leading-none">Total Fare</p>
            <h4 className="text-4xl font-black leading-none italic uppercase">₹{ride.price}</h4>
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
          className="flex-1 py-5 border border-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-all text-black uppercase"
        >
          Message
        </button>
        <button
          onClick={handleJoinRide}
          disabled={booking || !canJoin}
          className="flex-[1.5] py-5 bg-black text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-900 active:scale-[0.98] transition-all disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {booking ? 'Joining...' : isJoined ? 'Joined' : isDriver ? 'Your Ride' : canJoin ? 'Join Ride' : 'Closed'}
        </button>
      </div>
    </div>
  );
}

export default RideDetailsPage;
