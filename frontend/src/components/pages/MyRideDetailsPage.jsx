import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { API_BASE_URL } from '../../config/api';
import { showNotification } from '../../utils/notifications';

const getPassengers = (ride) => {
  if (ride && ride.passengers && ride.passengers.length > 0) {
    return ride.passengers.map((p, i) => ({
      id: p.user || p.userId || i,
      name: p.name || 'Unknown',
      rating: p.rating || 0,
      avatar: p.avatar || (p.name || 'U')[0].toUpperCase(),
      joined: p.joined || p.status === 'joined',
      status: p.status || (p.joined ? 'joined' : 'booked')
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
  
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewTargetId, setReviewTargetId] = useState(null);
  const [reviewTargetName, setReviewTargetName] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const currentUserId = localStorage.getItem('userId');
  const isDriver = ride ? (ride.driverId || ride.createdBy) === currentUserId : false;

  const fetchRide = async () => {
    const rideId = ride?.id || ride?._id || location.state?.rideId;
    if (!rideId) return;

    try {
      console.log("API CALL:", `${API_BASE_URL}/api/ride/${rideId}`);
      const response = await fetch(`${API_BASE_URL}/api/ride/${rideId}`);
      const data = await response.json();
      if (response.ok && data.success) {
        setRide(prev => ({ ...data.ride, role: prev?.role || data.ride.role }));
      }
    } catch (err) {
      console.error('Error fetching ride details:', err);
    } finally {
      if (loading) setLoading(false);
    }
  };

  useEffect(() => {
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
    const url = `${API_BASE_URL}/api/cancel-ride/${rideId}`;
    
    setCancelling(true);
    try {
      console.log("API CALL:", url, 'POST');
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await response.json();
      
      if (response.ok && data.success) {
        showToast(data.message || "Ride updated successfully", "success");
        navigate('/user/home', { state: { activeTab: 'my-rides' } });
      } else {
        showToast(data.message || 'Failed to cancel ride', "error");
      }
    } catch (err) {
      console.error(err);
      showToast(`Server error: ${err.message || 'Check connection'}`, "error");
    } finally {
      setCancelling(false);
    }
  };

  const handleOpenReview = (userId, name) => {
    setReviewTargetId(userId);
    setReviewTargetName(name);
    setReviewRating(5);
    setReviewComment('');
    setShowReviewModal(true);
  };
  
  const submitReview = async () => {
    if (reviewRating === 0) {
      showToast("Please select a rating!", "error");
      return;
    }
    setSubmittingReview(true);
    try {
      const fromUser = localStorage.getItem('userId');
      console.log("API CALL:", `${API_BASE_URL}/api/submit-review`);
      const response = await fetch(`${API_BASE_URL}/api/submit-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUser,
          toUser: reviewTargetId,
          rideId: ride.id || ride._id,
          rating: reviewRating,
          comment: reviewComment
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        showToast(`Your review for ${reviewTargetName} has been submitted!`, "success");
        setRatedUserIds(prev => [...prev, reviewTargetId]);
        setShowReviewModal(false);
      } else {
        showToast(data.message || 'Failed to submit review', "error");
      }
    } catch (err) {
      console.error(err);
      showToast(`Server error: ${err.message || 'Check connection'}`, "error");
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleStartRide = async () => {
    const rideId = ride.id || ride._id;
    try {
      console.log("API CALL:", `${API_BASE_URL}/api/start-ride`);
      const response = await fetch(`${API_BASE_URL}/api/start-ride`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rideId, userId: currentUserId })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        showNotification("Ride Started 🚗", `Your ride to ${ride.toLocation || ride.to} has started!`);
        showToast("Ride started!", "success");
        await fetchRide();
      } else {
        showToast(data.message || "Failed to start ride", "error");
      }
    } catch (err) {
      showToast(`Connection error: ${err.message}`, "error");
    }
  };

  const handleFinishRide = async () => {
    try {
      const rideId = ride.id || ride._id;
      console.log("Calling finish API:", rideId);

      const response = await fetch(`${API_BASE_URL}/api/finish-ride`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rideId, userId: currentUserId })
      });

      const data = await response.json();
      console.log("Finish response:", data);

      if (data.success) {
        showNotification("Ride Completed ✅", `Hope you had a safe journey to ${ride.toLocation || ride.to}`);
        showToast('Ride finished successfully!', 'success');
        // Optimistic UI update
        setRide(prev => ({ ...prev, status: 'completed' }));
        await fetchRide();
      } else {
        throw new Error(data.message || "Failed to finish ride");
      }
    } catch (err) {
      console.error("Finish error:", err);
      showToast(err.message || 'Error finishing ride', 'error');
    }
  };

  const handleCheckIn = async () => {
    try {
      const rideId = ride.id || ride._id;
      const response = await fetch(`${API_BASE_URL}/api/join-ride`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, rideId })
      });
      const data = await response.json();
      if (data.success) {
        showNotification("Passenger Joined 👤", `You have checked into the ride to ${ride.toLocation || ride.to}`);
        showToast('Successfully checked into the ride!', 'success');
        await fetchRide();
      } else {
        showToast(data.message || 'Check-in failed', 'error');
      }
    } catch (err) {
      showToast('Error during check-in', 'error');
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
      console.log("API CALL:", `${API_BASE_URL}/api/report-user`);
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
            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
              ride.status === 'ongoing' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
              ride.status === 'completed' ? 'bg-gray-50 text-gray-400 border-gray-100' : 
              'bg-black text-white'
            }`}>
              {ride.status || 'UPCOMING'}
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
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs font-black text-black leading-none">{passenger.name}</p>
                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border transition-all ${
                          passenger.status === 'joined' 
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                            : 'bg-gray-50 text-gray-400 border-gray-100'
                        }`}>
                          {passenger.status === 'joined' ? 'Joined ✅' : 'Booked 🕒'}
                        </span>
                      </div>
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

                {ride.status?.toLowerCase() === 'completed' && ride.role === 'Driver' && !ratedUserIds.includes(passenger.id) && (
                  <div className="mt-4 pt-4 border-t border-gray-50 flex justify-end">
                    <button
                      onClick={() => handleOpenReview(passenger.id, passenger.name)}
                      className="text-[10px] font-black text-amber-500 uppercase tracking-widest border border-amber-100 bg-amber-50/50 px-6 py-2.5 rounded-xl hover:bg-amber-500 hover:text-white transition-all active:scale-95 shadow-sm shadow-amber-200/20"
                    >
                      ⭐ Rate Passenger
                    </button>
                  </div>
                )}
                {ratedUserIds.includes(passenger.id) && (
                   <div className="mt-4 pt-4 border-t border-gray-50">
                     <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1.5 px-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Review Submitted
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
          <div className="pt-4 border-t border-gray-50 flex flex-col gap-6">
            
            {/* ── Driver Profile Summary (Safe Render) ── */}
            <div className="bg-gray-50/50 p-6 rounded-[2rem] border border-gray-100 flex items-center gap-4">
              <div className="w-12 h-12 bg-black rounded-xl flex-shrink-0 flex items-center justify-center text-white overflow-hidden shadow-sm">
                {ride.driver?.avatar ? (
                  <img src={ride.driver.avatar} alt="driver" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-black">
                    {(typeof ride.driver === 'object' ? (ride.driver?.name || 'D') : (ride.driver || 'D'))[0].toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5 italic">Your Captain</p>
                <h4 className="text-xs font-black text-black uppercase tracking-tight">
                  {typeof ride.driver === 'object' ? ride.driver?.name : (ride.driver || "Verified Driver")}
                </h4>
              </div>
              <div className="bg-white px-3 py-1.5 rounded-full border border-gray-100 flex items-center gap-1.5 shadow-sm">
                <span className="text-[10px] font-black text-black">⭐ {(typeof ride.driver === 'object' ? ride.driver?.rating : ride.rating) || '5.0'}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleChat(
                  ride.driverId || ride.createdBy, 
                  typeof ride.driver === "object" ? ride.driver?.name : ride.driver
                )}
                className="flex-1 bg-white border-2 border-black text-black py-4 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] shadow-sm hover:bg-gray-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Message Driver
              </button>
              <button
                onClick={() => openReportModal(
                  ride.driverId || ride.createdBy, 
                  typeof ride.driver === "object" ? ride.driver?.name : (ride.driver || 'Driver')
                )}
                className="w-16 bg-gray-50 text-gray-400 rounded-[2rem] flex items-center justify-center hover:text-red-500 transition-colors"
                title="Report Driver"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </button>
            </div>

            {/* ── Participation Sync (NEW) ── */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Manifest & Participation</h3>
                <span className="text-[9px] font-bold text-gray-400 uppercase">{ride.passengers?.length || 0} / {ride.capacity || 0} Filled</span>
              </div>
              
              <div className="space-y-3">
                {(ride.passengers || ride.passengerDetails || []).map((p, idx) => (
                  <div key={idx} className="bg-white border border-gray-100 p-4 rounded-2xl flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-[10px] font-black text-white">
                        {p.avatar || (p.name || 'P')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-black uppercase tracking-tight">{p.name}</p>
                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">{p.collegeId || 'ID Verified'}</p>
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                      (p.joined || p.status === 'joined')
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                        : 'bg-gray-50 text-gray-400 border-gray-100'
                    }`}>
                      {(p.joined || p.status === 'joined') ? '● Checked In' : '○ Not Joined'}
                    </div>
                  </div>
                ))}
              </div>

              {/* Passenger Check-in Action */}
              {ride.role === 'Passenger' && ride.status === 'ongoing' && !((ride.passengers || []).find(p => String(p.userId || p.user) === String(currentUserId))?.joined || (ride.passengers || []).find(p => String(p.userId || p.user) === String(currentUserId))?.status === 'joined') && (
                <button
                  onClick={handleCheckIn}
                  className="w-full bg-emerald-500 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 active:scale-95 transition-all mt-4"
                >
                  Confirm Joining (Check-in)
                </button>
              )}
            </div>

            {/* ── Feedback Status (If already rated) ── */}
            {ride.status?.toLowerCase() === 'completed' && ratedUserIds.includes(ride.driverId || ride.createdBy) && (
               <div className="bg-emerald-50/30 p-6 rounded-[2.5rem] mt-4 border border-emerald-100 flex items-center justify-center gap-3">
                  <div className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Feedback Provided</span>
               </div>
            )}
          </div>
        )}

        {/* ── Action Buttons ── */}
        <div className="pt-8 space-y-4">
          {isDriver && (ride.status === 'upcoming') && (
            <button
              onClick={handleStartRide}
              className="w-full bg-black text-white py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-black/10 hover:opacity-90 active:scale-[0.98] transition-all"
            >
              Start Ride
            </button>
          )}

          {isDriver && ride.status === 'ongoing' && (
            <button
              onClick={handleFinishRide}
              className="w-full bg-black text-white py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-black/10 hover:opacity-90 active:scale-[0.98] transition-all"
            >
              Finish Ride
            </button>
          )}

          {/* ── Driver Finishing / Cancellation ── */}
          {ride.status !== 'completed' && (
            <button
              onClick={handleCancelRide}
              disabled={cancelling}
              className="w-full bg-white border-2 border-black text-black py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-gray-50 active:scale-[0.98] transition-all disabled:opacity-30 disabled:grayscale"
            >
              {cancelling ? 'Processing...' : 'Cancel Ride'}
            </button>
          )}

          {/* ── Passenger Rating Action (Primary) ── */}
          {ride.status?.toLowerCase() === 'completed' && ride.role === 'Passenger' && !ratedUserIds.includes(ride.driverId || ride.createdBy) && (
            <button
              onClick={() => handleOpenReview(ride.driverId || ride.createdBy, typeof ride.driver === "object" ? ride.driver?.name : (ride.driver || "Driver"))}
              className="w-full bg-black text-white py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-black/10 hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              Rate Your Ride
            </button>
          )}
        </div>

      </div>

      {/* ── Review Modal ── */}
      {showReviewModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !submittingReview && setShowReviewModal(false)}></div>
           <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 space-y-8 relative overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
              <header className="space-y-1">
                 <h3 className="text-sm font-black text-black uppercase tracking-widest">Rate Experience</h3>
                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest italic">{reviewTargetName}</p>
              </header>

              <div className="space-y-8">
                 <div className="flex flex-col items-center gap-4 py-4">
                    <div className="flex gap-2">
                       {[1, 2, 3, 4, 5].map((star) => (
                          <button
                             key={star}
                             onClick={() => setReviewRating(star)}
                             className="transform active:scale-90 transition-transform p-1"
                          >
                             <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                className={`h-10 w-10 ${reviewRating >= star ? 'text-amber-400' : 'text-gray-100'} transition-colors drop-shadow-sm`} 
                                fill="currentColor" 
                                viewBox="0 0 24 24"
                             >
                                <path d="M12 .587l3.668 7.568 8.332 1.151-6.064 5.828 1.48 8.279-7.416-3.967-7.417 3.967 1.481-8.279-6.064-5.828 8.332-1.151z" />
                             </svg>
                          </button>
                       ))}
                    </div>
                    <span className="text-[11px] font-black text-black uppercase tracking-[0.2em]">
                       {reviewRating === 5 ? 'Excellent' : 
                        reviewRating === 4 ? 'Very Good' : 
                        reviewRating === 3 ? 'Good experience' : 
                        reviewRating === 2 ? 'Needs improvement' : 
                        reviewRating === 1 ? 'Poor Experience' : 'Select Rating'}
                    </span>
                 </div>

                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-gray-300 uppercase tracking-widest px-1">Describe Experience</label>
                    <textarea 
                       rows="4" 
                       value={reviewComment}
                       onChange={(e) => setReviewComment(e.target.value)}
                       placeholder="What was great? Any suggestions for improvement?"
                       className="w-full bg-gray-50 border border-transparent rounded-2xl p-5 text-[11px] font-bold focus:outline-none focus:bg-white focus:border-black transition-all resize-none placeholder:text-gray-200"
                    />
                 </div>
              </div>

              <div className="flex flex-col gap-3">
                 <button
                    onClick={submitReview}
                    disabled={submittingReview || reviewRating === 0}
                    className="w-full py-5 bg-black text-white text-[11px] font-black uppercase tracking-[0.3em] rounded-2xl hover:bg-gray-800 active:scale-95 transition-all shadow-xl shadow-black/10 disabled:opacity-20"
                 >
                    {submittingReview ? 'Submitting...' : 'Post Review'}
                 </button>
                 <button
                    onClick={() => setShowReviewModal(false)}
                    disabled={submittingReview}
                    className="w-full py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-black transition-colors"
                 >
                    Cancel
                 </button>
              </div>
           </div>
        </div>
      )}

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
