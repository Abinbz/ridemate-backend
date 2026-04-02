import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { API_BASE_URL } from '../../config/api';

const getPassengers = (ride) => {
  if (ride && ride.passengerDetails && ride.passengerDetails.length > 0) {
    return ride.passengerDetails.map((p, i) => ({
      id: p.userId || i,
      name: p.name || 'Unknown',
      rating: p.rating || 0,
      avatar: p.avatar || (p.name || 'U')[0].toUpperCase()
    }));
  }
  return [];
};

function MyRideDetailsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const [ride, setRide] = useState(location.state?.ride || null);
  const [loading, setLoading] = useState(!location.state?.ride);

  const [ratingVal, setRatingVal] = useState(0);
  const [comment, setComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [ratedUserIds, setRatedUserIds] = useState([]);

  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTargetId, setReportTargetId] = useState(null);
  const [reportTargetName, setReportTargetName] = useState('');
  const [reportReason, setReportReason] = useState('Late pickup');
  const [reportDetails, setReportDetails] = useState('');
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    const fetchRide = async () => {
      const rideId = ride?.id || ride?._id || location.state?.rideId;
      if (!rideId) return;

      try {
        const response = await fetch(`${API_BASE_URL}/api/ride/${rideId}`);
        const data = await response.json();
        if (response.ok && data.success) {
          setRide(data.ride);
        }
      } catch (err) {
        console.error('Error fetching ride details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRide();
    const interval = setInterval(fetchRide, 10000);
    return () => clearInterval(interval);
  }, [ride?.id, ride?._id, location.state?.rideId]);

  if (!ride) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 space-y-4">
        <h2 className="text-sm font-black text-black uppercase tracking-widest">No ride details found</h2>
        <button
          onClick={() => navigate(-1)}
          className="text-xs font-black text-black border-b border-black pb-0.5 hover:text-gray-400 hover:border-gray-400 transition-all"
        >
          Go Back
        </button>
      </div>
    );
  }

  const handleCancelRide = async () => {
    if (!window.confirm("Are you sure you want to cancel this ride?")) return;
    
    const userId = localStorage.getItem('userId');
    const rideId = ride.id || ride._id;
    const isDriver = ride.role === 'Driver';
    const endpoint = isDriver ? '/api/cancel-ride-driver' : '/api/cancel-ride-passenger';
    
    setCancelling(true);
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rideId, userId })
      });
      const data = await response.json();
      
      if (response.ok && data.success) {
        showToast(data.message || "Ride cancelled successfully", "success");
        navigate('/user/home', { state: { activeTab: 'my-rides' } });
      } else {
        showToast(data.message || 'Failed to cancel ride', "error");
      }
    } catch (err) {
      console.error(err);
      showToast('Server not reachable. Check backend connection.', "error");
    } finally {
      setCancelling(false);
    }
  };

  const handleRate = async (toUserId, isPassenger) => {
    if (ratingVal === 0) {
      showToast("Please select a rating!", "error");
      return;
    }
    setSubmittingRating(true);
    try {
      const fromUser = localStorage.getItem('userId');
      const response = await fetch(`${API_BASE_URL}/api/add-rating`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUser,
          toUser: toUserId,
          rideId: ride.id,
          rating: ratingVal,
          comment
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        showToast("Thanks for your feedback", "success");
        setRatedUserIds(prev => [...prev, toUserId]);
        setRatingVal(0);
        setComment('');
      } else {
        showToast(data.message || 'Failed to submit rating', "error");
      }
    } catch (err) {
      console.error(err);
      showToast('Server not reachable. Check backend connection.', "error");
    } finally {
      setSubmittingRating(false);
    }
  };

  const handleStartRide = async () => {
    const userId = localStorage.getItem('userId');
    const rideId = ride.id || ride._id;
    try {
      const response = await fetch(`${API_BASE_URL}/api/start-ride`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rideId, userId })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        showToast("Ride started!", "success");
        navigate('/user/home', { state: { activeTab: 'my-rides' } });
      } else {
        showToast(data.message || "Failed to start ride", "error");
      }
    } catch (err) {
      showToast("Connection error", "error");
    }
  };

  const handleEndRide = async () => {
    const userId = localStorage.getItem('userId');
    const rideId = ride.id || ride._id;
    try {
      const response = await fetch(`${API_BASE_URL}/api/end-ride`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rideId, userId })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        showToast("Ride completed!", "success");
        navigate('/user/home', { state: { activeTab: 'my-rides' } });
      } else {
        showToast(data.message || "Failed to end ride", "error");
      }
    } catch (err) {
      showToast("Connection error", "error");
    }
  };


  const handleChat = (contactId, contactName) => {
    navigate('/chat', {
      state: {
        receiverId: contactId,
        receiverName: contactName || 'Unknown'
      }
    });
  };

  const openReportModal = (uid, name) => {
    setReportTargetId(uid);
    setReportTargetName(name);
    setShowReportModal(true);
  };

  const handleReport = async () => {
    try {
      setReporting(true);
      const userId = localStorage.getItem('userId');
      const res = await fetch(`${API_BASE_URL}/api/report-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporterId: userId,
          reportedId: reportTargetId,
          rideId: ride?.id || ride?._id,
          reason: reportReason,
          details: reportDetails
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Report submitted to admin', 'success');
        setShowReportModal(false);
      } else {
        showToast(data.message || 'Report failed', 'error');
      }
    } catch (err) {
      showToast('Connection error', 'error');
    } finally {
      setReporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white pb-32 relative">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-50 px-6 py-6 flex items-center gap-4 sticky top-0 z-50">
        <button onClick={() => navigate(-1)} className="text-black hover:opacity-50 transition-opacity">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-[10px] font-black text-black uppercase tracking-[0.2em]">Ride Overview</h1>
      </div>

      <div className="max-w-md mx-auto px-6 py-10 space-y-8">

        {/* ── Ride Info Card ── */}
        <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <span className="bg-black text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">
              {ride.status}
            </span>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              {ride.role}
            </span>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-black text-black leading-tight italic uppercase">
              {ride.from} <br />
              <span className="text-gray-200 text-lg not-italic">&rarr;</span> <br />
              {ride.to}
            </h2>

            <div className="pt-4 border-t border-gray-50 grid grid-cols-2 gap-6">
              <div>
                <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-1">Departure</p>
                <p className="text-xs font-black text-black">{ride.date}</p>
                <p className="text-[10px] font-bold text-gray-400 mt-0.5">{ride.time}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-1">Fare Charged</p>
                <p className="text-lg font-black text-black">{ride.price}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Passengers Section ── */}
        <div className="space-y-6">
          <h3 className="text-[11px] font-black text-black uppercase tracking-[0.1em] flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-black rounded-full shadow-[0_0_8px_rgba(0,0,0,0.1)]"></span>
            Passengers
          </h3>
          <div className="border border-gray-100 rounded-[2rem] overflow-hidden bg-white">
            {getPassengers(ride).map((passenger, index) => (
              <div
                key={passenger.id}
                className={`flex flex-col p-5 hover:bg-gray-50 transition-colors ${index !== getPassengers(ride).length - 1 ? 'border-b border-gray-50' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-[11px] font-black text-black">
                      {passenger.avatar}
                    </div>
                    <div>
                      <p className="text-xs font-black text-black leading-none mb-1">{passenger.name}</p>
                      <div className="flex items-center gap-1 text-[9px] font-bold text-gray-300 uppercase tracking-widest">
                        <span>Rating</span>
                        <span className="text-black font-black">{passenger.rating} ⭐</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleChat(passenger.id, passenger.name)}
                      className="text-[10px] font-black text-black uppercase tracking-widest border border-gray-200 px-4 py-2 rounded-xl hover:bg-black hover:text-white hover:border-black transition-all active:scale-[0.98]"
                    >
                      Message
                    </button>
                    <button
                      onClick={() => openReportModal(passenger.id, passenger.name)}
                      className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-100 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {ride.status === 'Completed' && ride.role === 'Driver' && !ratedUserIds.includes(passenger.id) && (
                  <div className="mt-4 pt-4 border-t border-gray-50 bg-amber-50/30 p-4 rounded-2xl animate-in slide-in-from-top-2 duration-300">
                    <h4 className="text-[9px] font-black text-black uppercase tracking-widest mb-3 flex items-center gap-2">
                       <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse"></span>
                       Rate {passenger.name}
                    </h4>
                    <div className="flex gap-2 mb-4">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button key={star} onClick={() => setRatingVal(star)} className="transform active:scale-90 transition-transform">
                          <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${ratingVal >= star ? 'text-amber-400' : 'text-gray-200'} transition-colors`} fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 .587l3.668 7.568 8.332 1.151-6.064 5.828 1.48 8.279-7.416-3.967-7.417 3.967 1.481-8.279-6.064-5.828 8.332-1.151z" />
                          </svg>
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Optional comment..."
                      className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl text-[10px] font-bold focus:outline-none focus:border-black mb-4 placeholder:text-gray-200"
                    />
                    <button
                      onClick={() => handleRate(passenger.id, true)}
                      disabled={submittingRating || ratingVal === 0}
                      className="w-full bg-black text-white px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-900 transition-all disabled:opacity-50 active:scale-95 shadow-lg shadow-black/10"
                    >
                      {submittingRating ? 'Saving...' : 'Submit Rating'}
                    </button>
                  </div>
                )}
                {ratedUserIds.includes(passenger.id) && (
                   <div className="mt-4 pt-4 border-t border-gray-50 text-center">
                     <p className="text-[10px] font-black text-green-500 uppercase tracking-widest flex items-center justify-center gap-1">
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                         <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                       </svg>
                       Rating Submitted
                     </p>
                   </div>
                )}

              </div>
            ))}
          </div>
        </div>

        {/* ── Vehicle Details Section ── */}
        <div className="bg-gray-50 rounded-3xl p-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-sm font-black shadow-sm">
              {(ride.vehicle || ride.vehicleType || 'V')[0]}
            </div>
            <div>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 italic">Assigned Vehicle</p>
              <p className="text-xs font-black text-black uppercase tracking-tight">{ride.vehicle || `${ride.vehicleType || 'Car'} (${ride.vehicleName || 'Unknown'})`}</p>
            </div>
          </div>
          <div className="text-gray-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        {/* ── Driver Contact (If Passenger) ── */}
        {ride.role === 'Passenger' && ride.createdBy && (
          <div className="pt-4 border-t border-gray-50 flex flex-col gap-4">
            <div className="flex gap-2">
              <button
                onClick={() => handleChat(ride.driverId || ride.createdBy, ride.driver)}
                className="flex-1 bg-white border-2 border-black text-black py-4 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] shadow-sm hover:bg-gray-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Message Driver
              </button>
              <button
                onClick={() => openReportModal(ride.driverId || ride.createdBy, ride.driver || 'Driver')}
                className="w-16 bg-gray-50 text-gray-400 rounded-[2rem] flex items-center justify-center hover:text-red-500 transition-colors"
                title="Report Driver"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </button>
            </div>

            {ride.status === 'Completed' && !ratedUserIds.includes(ride.driverId || ride.createdBy) && (
              <div className="bg-amber-50/30 p-8 rounded-[2.5rem] mt-4 animate-in slide-in-from-top-2 duration-400">
                <h3 className="text-[11px] font-black text-black uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                   <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse"></div>
                   Rate your Driver
                </h3>
                <div className="flex gap-3 mb-8">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} onClick={() => setRatingVal(star)} className="transform active:scale-90 transition-transform">
                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-8 w-8 ${ratingVal >= star ? 'text-amber-400' : 'text-gray-200'} transition-colors`} fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 .587l3.668 7.568 8.332 1.151-6.064 5.828 1.48 8.279-7.416-3.967-7.417 3.967 1.481-8.279-6.064-5.828 8.332-1.151z" />
                      </svg>
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Optional feedback for driver..."
                  className="w-full px-5 py-4 bg-white border border-gray-100 rounded-2xl text-[11px] font-bold focus:outline-none focus:border-black transition-all mb-6 placeholder:text-gray-200"
                />
                <button
                  onClick={() => handleRate(ride.driverId || ride.createdBy, false)}
                  disabled={submittingRating || ratingVal === 0}
                  className="w-full bg-black text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-gray-900 transition-all disabled:opacity-50 active:scale-95 shadow-xl shadow-black/10"
                >
                  {submittingRating ? 'Submitting...' : 'Submit Driver Rating'}
                </button>
              </div>
            )}
            {ratedUserIds.includes(ride.driverId || ride.createdBy) && (
               <div className="bg-green-50/50 p-6 rounded-[2rem] mt-4 flex items-center justify-center gap-2 border border-green-100">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">Driver Rated Successfully</span>
               </div>
            )}
          </div>
        )}

        {/* ── Action Buttons ── */}
        <div className="pt-8 space-y-4">
          {ride.role === 'Driver' && (ride.status === 'Scheduled' || ride.status === 'Upcoming') && (
            <button
              onClick={handleStartRide}
              className="w-full bg-black text-white py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-black/10 hover:opacity-90 active:scale-[0.98] transition-all"
            >
              Start Ride
            </button>
          )}

          {ride.role === 'Driver' && ride.status === 'Ongoing' && (
            <button
              onClick={handleEndRide}
              className="w-full bg-black text-white py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-black/10 hover:opacity-90 active:scale-[0.98] transition-all"
            >
              End Ride
            </button>
          )}

          <button
            onClick={handleCancelRide}
            disabled={cancelling || ride.status === 'Completed'}
            className="w-full bg-white border-2 border-black text-black py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-gray-50 active:scale-[0.98] transition-all disabled:opacity-30 disabled:grayscale"
          >
            {cancelling ? 'Processing...' : ride.status === 'Completed' ? 'Ride Finished' : 'Cancel Ride'}
          </button>
        </div>

      </div>

      {/* ── Report Modal ── */}
      {showReportModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowReportModal(false)}></div>
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 space-y-8 relative overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-black uppercase tracking-widest">Report Concern</h3>
                <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-widest">Reporting: {reportTargetName}</p>
              </div>
              <button 
                onClick={() => setShowReportModal(false)}
                className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:text-black transition-colors"
                disabled={reporting}
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Nature of Issue</label>
                <div className="grid grid-cols-1 gap-2">
                  {['Late pickup', 'Reckless driving', 'Rude behavior', 'Vehicle mismatch', 'Other'].map((r) => (
                    <button
                      key={r}
                      onClick={() => setReportReason(r)}
                      className={`px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all text-left ${
                        reportReason === r ? 'bg-black text-white border-black' : 'bg-white border-gray-100 text-gray-300'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Describe clearly</label>
                <textarea 
                  rows="3"
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Share details to help admin resolve..."
                  className="w-full px-5 py-4 bg-gray-50 border border-transparent rounded-2xl text-[11px] font-bold focus:outline-none focus:bg-white focus:border-black transition-all resize-none placeholder:text-gray-200"
                ></textarea>
              </div>
            </div>

            <button 
              onClick={handleReport}
              disabled={reporting}
              className="w-full py-5 bg-black text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-3xl hover:bg-gray-800 active:scale-95 transition-all disabled:opacity-20 shadow-xl shadow-black/20"
            >
              {reporting ? 'Filing Report...' : 'Submit to Admin'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyRideDetailsPage;
