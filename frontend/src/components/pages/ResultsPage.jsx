// import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

function ResultsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = location.state?.searchData || {};
  const searchResponseData = location.state?.searchResponseData;
  const normalize = (str) => (str || "").toLowerCase().trim();
  const search = { from: searchParams.startingFrom, to: searchParams.goingTo };

  const allRides = [
    ...(searchResponseData?.recommended || []),
    ...(searchResponseData?.others || [])
  ];

  const filteredRides = allRides.filter((ride) =>
    normalize(ride.from).includes(normalize(search.from)) &&
    normalize(ride.to).includes(normalize(search.to))
  );

  const displayRecommended = filteredRides.slice(0, 2);
  const displayOthers = filteredRides.slice(2);
  const totalMatches = filteredRides.length;

  const renderRideCard = (ride, isRecommended = false) => (
    <div
      key={ride.id || ride._id}
      onClick={() => navigate('/user/ride-details', { state: { ride } })}
      className={`bg-white border p-8 rounded-[2.5rem] transition-all cursor-pointer group relative shadow-sm ${
        isRecommended ? 'border-emerald-500 border-2 shadow-xl shadow-emerald-50/50 scale-[1.02]' : 'border-gray-50 hover:border-black'
      }`}
    >
      {isRecommended && (
        <div className="absolute -top-3 left-8 bg-emerald-500 text-white px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg flex items-center gap-1 border-2 border-white">
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
          <span>Recommended</span>
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-black text-white rounded-2xl flex items-center justify-center text-sm font-black group-hover:scale-95 transition-transform">
            {(ride?.driver?.name || (typeof ride?.driver === 'string' ? ride.driver : 'D'))[0]?.toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-black text-black leading-none mb-1">{ride?.driver?.name || (typeof ride?.driver === 'string' ? ride.driver : "Driver")}</p>
            <div className="flex items-center gap-1">
               <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Rating</span>
               <span className="text-[10px] font-black text-black">{ride.rating}</span>
               {ride.totalRatings > 0 && (
                 <span className="text-[8px] font-bold text-gray-200 lowercase">({ride.totalRatings} reviews)</span>
               )}
            </div>
          </div>
        </div>
        <div className="text-right">
           <div className="text-[10px] font-black bg-black text-white px-3 py-1 rounded-full uppercase tracking-widest inline-block">
             {ride.vehicleType}
           </div>
           <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mt-2">
             {ride.vehicleName}
             {ride.bookedUsers?.includes(localStorage.getItem('userId')) && (
               <span className="ml-2 px-2 py-0.5 bg-black text-white text-[7px] font-black uppercase tracking-widest rounded-full opacity-30">Joined</span>
             )}
           </p>
        </div>
      </div>

      <div className="space-y-4 mb-8">
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-center mt-1.5">
            <div className="w-2 h-2 rounded-full bg-black"></div>
            <div className="w-px h-8 bg-gray-100"></div>
            <div className="w-2 h-2 rounded-full border-2 border-black bg-white"></div>
          </div>
          <div className="flex-1 space-y-4">
            <div className="flex justify-between items-center">
               <p className="text-xs font-bold text-gray-500 uppercase tracking-tight truncate pr-4">{ride.from}</p>
               <p className="text-xs font-black text-black shrink-0">{ride.start}</p>
            </div>
            <div className="flex justify-between items-center">
               <p className="text-xs font-bold text-gray-500 uppercase tracking-tight truncate pr-4">{ride.to}</p>
               <p className="text-xs font-black text-black shrink-0">{ride.end}</p>
            </div>
          </div>
        </div>
      </div>

       <div className="flex items-center justify-between pt-6 border-t border-gray-50">
          <div className="flex items-center gap-4">
             <button 
               onClick={(e) => {
                 e.stopPropagation();
                  navigate('/chat', { 
                    state: { 
                      receiverId: ride.driverId || ride.createdBy, 
                      receiverName: ride?.driver?.name || (typeof ride?.driver === 'string' ? ride.driver : "Driver")
                    } 
                  });

               }}
               className="w-10 h-10 flex items-center justify-center bg-gray-50 text-black rounded-2xl hover:bg-black hover:text-white transition-all shadow-sm"
               title="Message Driver"
             >
               💬
             </button>
             <div className="w-px h-6 bg-gray-100 mx-2"></div>
             <div>
                <p className="text-sm font-black text-black">{ride.duration || "Variable"}</p>
                <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">Duration</p>
             </div>
             <div className="w-px h-6 bg-gray-100 mx-2"></div>
              <div>
                 <p className="text-sm font-black text-black">{Array.isArray(ride.passengers) ? ride.passengers.length : (ride.passengers || 0)}</p>
                 <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">Seats</p>
              </div>
          </div>
          <div className="text-right">
             <p className="text-2xl font-black text-black leading-none">₹{ride.price?.toString() || "0"}</p>
             <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mt-1 italic">per seat</p>
          </div>
       </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      {/* ── Minimalist Header ── */}
      <div className="border-b border-gray-50 px-6 py-12 text-center">
        <h1 className="text-3xl font-black tracking-tighter text-black uppercase">Available Rides</h1>
        <p className="text-gray-300 text-[10px] font-bold uppercase tracking-[0.2em] mt-2 italic">
          {searchParams.startingFrom || 'Any'} &rarr; {searchParams.goingTo || 'Any'}
        </p>
      </div>

      {/* ── Results List ── */}
      <div className="max-w-xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">
            Found <span className="text-black">{totalMatches}</span> matches
          </p>
          <button 
            onClick={() => navigate('/user/home')}
            className="text-[10px] font-black text-black uppercase tracking-widest border-b border-black pb-0.5 hover:text-gray-400 hover:border-gray-400 transition-all font-bold"
          >
            Modify Search
          </button>
        </div>

        {displayRecommended.length === 0 && displayOthers.length === 0 && (
          <div className="text-center py-24 bg-gray-50 rounded-[3rem] border border-dashed border-gray-100">
             <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                <span className="text-2xl">🚗</span>
             </div>
             <h3 className="text-sm font-black text-black uppercase tracking-widest mb-2">No rides yet</h3>
             <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest max-w-[200px] mx-auto leading-relaxed">
                Try a different route or check back later!
             </p>
          </div>
        )}

        {displayRecommended.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-black tracking-tighter text-black uppercase mb-8 flex items-center gap-2">
              Recommended Rides
              <div className="h-px flex-1 bg-gray-100"></div>
            </h2>
            <div className="space-y-8">
              {displayRecommended.map(ride => renderRideCard(ride, true))}
            </div>
          </div>
        )}

        {displayOthers.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-black tracking-tighter text-black uppercase mb-8 flex items-center gap-2">
              All Rides
              <div className="h-px flex-1 bg-gray-100"></div>
            </h2>
            <div className="space-y-6">
              {displayOthers.map(ride => renderRideCard(ride, false))}
            </div>
          </div>
        )}



        {/* Home Button */}
        <button
          onClick={() => navigate('/user/home')}
          className="w-full mt-12 py-5 bg-black text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-900 active:scale-[0.98] transition-all font-bold"
        >
          Return to Search
        </button>
      </div>
    </div>
  );
}

export default ResultsPage;
