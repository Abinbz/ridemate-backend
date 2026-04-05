import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../../config/api';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getCoordinates, isValidCoords, DEFAULT_COORDS } from '../../utils/geoUtils';

// Fix for default marker icon in React Leaflet
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Helper component to auto-recenter and fit map bounds
function ChangeView({ startCoords, endCoords, routeData }) {
  const map = useMap();
  useEffect(() => {
    const hasStart = startCoords && isValidCoords(startCoords[0], startCoords[1]);
    const hasEnd = endCoords && isValidCoords(endCoords[0], endCoords[1]);

    if (hasStart && hasEnd) {
      const bounds = L.latLngBounds([startCoords, endCoords]);
      if (routeData && routeData.length > 0) {
        routeData.forEach(point => {
          if (isValidCoords(point[0], point[1])) bounds.extend(point);
        });
      }
      map.fitBounds(bounds, { padding: [50, 50], animate: true });
    } else if (hasStart) {
      map.setView(startCoords, 14);
    }
  }, [startCoords, endCoords, routeData, map]);
  return null;
}

function PostPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    startingFrom: '',
    goingTo: '',
    date: '',
    time: '',
    passengers: 1,
    passengerPreference: 'Any',
    vehicleType: 'Car',
    vehicleName: 'Swift',
    price: '',
    isRoundTrip: false,
    returnDate: '',
    returnTime: '',
    returnPrice: ''
  });

  const [startCoords, setStartCoords] = useState(null);
  const [endCoords, setEndCoords] = useState(null);
  const [routeData, setRouteData] = useState([]);
  const [distance, setDistance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState(null);

  const getMapCenter = () => {
    if (startCoords && isValidCoords(startCoords[0], startCoords[1])) return startCoords;
    if (endCoords && isValidCoords(endCoords[0], endCoords[1])) return endCoords;
    return DEFAULT_COORDS;
  };

  // 🛡️ Security: Enforce driver eligibility on mount
  useEffect(() => {
    const checkDriverStatus = async () => {
        const userId = localStorage.getItem('userId');
        if (!userId) {
            navigate('/');
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/user/${userId}`);
            const data = await response.json();
            
            if (data.success) {
                setUserData(data.user);
                // Sync localStorage
                if (data.user.role) localStorage.setItem('role', data.user.role);
                if (data.user.isDriver !== undefined) localStorage.setItem('isDriver', data.user.isDriver ? 'true' : 'false');
                
                // Standardized Role-Based Access
                const isDriver = data.user.role === "driver";
                const isBanned = data.user.isBanned;

                if (!isDriver || isBanned) {
                    console.log("🔒 Access Blocked: User restricted or unverified.");
                    // Optional: Navigate to profile or show a barrier
                }
            }
        } catch (error) {
            console.error('Eligibility check failed:', error);
        }
    };

    checkDriverStatus();
  }, [navigate]);

  // Trigger route calculation automatically
  useEffect(() => {
    if (startCoords && endCoords) {
      const getRoute = async () => {
        const data = await fetchRoute(startCoords, endCoords);
        if (data) {
          setRouteData(data.coordinates);
          setDistance(data.distance);
        }
      };
      getRoute();
    } else {
      setRouteData([]);
      setDistance(null);
    }
  }, [startCoords, endCoords]);

  const fetchRoute = async (start, end) => {
    try {
      const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`);
      const data = await response.json();
      if (data && data.routes && data.routes.length > 0) {
        return {
          coordinates: data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]),
          distance: (data.routes[0].distance / 1000).toFixed(2)
        };
      }
      return null;
    } catch (error) {
      console.error('Routing error:', error);
      return null;
    }
  };

  // Handle return from MapPicker
  useEffect(() => {
    if (location.state && location.state.selection) {
      const { type, lat, lng, name } = location.state.selection;
      const extra = location.state.extraState || {};

      // Merge extra state (from previously selected locations or typed data)
      if (extra.formData) {
        setFormData(prev => ({ ...prev, ...extra.formData }));
      }
      if (extra.startCoords) {
        setStartCoords(extra.startCoords);
      }
      if (extra.endCoords) {
        setEndCoords(extra.endCoords);
      }

      // Finally, set the current selection
      if (type === 'start') {
        setFormData(prev => ({ ...prev, startingFrom: name }));
        setStartCoords([lat, lng]);
      } else if (type === 'end') {
        setFormData(prev => ({ ...prev, goingTo: name }));
        setEndCoords([lat, lng]);
      }

      // Clear state to avoid re-triggering
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  if (userData && (userData.role !== 'driver' || userData.isBanned)) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-6 text-center gap-6 animate-in fade-in duration-700">
            <div className="w-24 h-24 bg-gray-50 rounded-[2.5rem] flex items-center justify-center text-4xl shadow-sm border border-gray-100">🚫</div>
            <div className="space-y-2">
                <h2 className="text-xl font-black text-black uppercase tracking-tighter">Access restricted</h2>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest max-w-[280px] leading-relaxed">
                    {userData.isBanned ? "Your account is currently restricted for policy violations." : "Profile verification required to offer platform rides."}
                </p>
            </div>
            <button 
                onClick={() => navigate('/profile')}
                className="px-10 py-4 bg-black text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl hover:scale-105 transition-transform"
            >
                Verify Profile
            </button>
        </div>
    );
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleMapIconClick = (name) => {
    const currentQuery = formData[name];
    const type = name === 'startingFrom' ? 'start' : 'end';
    navigate(`/map-picker?type=${type}&query=${encodeURIComponent(currentQuery)}`, {
      state: {
        fromTab: 'post',
        extraState: {
          formData,
          startCoords,
          endCoords
        }
      }
    });
  };

  const handlePostRide = async (e) => {
    if (e) e.preventDefault();

    // 1. Debug Telemetry: Identify missing fields exactly
    console.log("Post Ride Attempt - Current Validation State:", {
      startingFrom: formData.startingFrom,
      goingTo: formData.goingTo,
      date: formData.date,
      time: formData.time,
      price: formData.price,
      vehicleName: formData.vehicleName,
      startCoords,
      endCoords
    });

    const isStartingFromFilled = formData.startingFrom && formData.startingFrom.trim() !== '';
    const isGoingToFilled = formData.goingTo && formData.goingTo.trim() !== '';
    const isDateFilled = !!formData.date;
    const isTimeFilled = !!formData.time;
    const isPriceFilled = formData.price !== "" && formData.price !== null;
    const isVehicleNameFilled = formData.vehicleName && formData.vehicleName.trim() !== '';

    if (!isStartingFromFilled || !isGoingToFilled || !isDateFilled || !isTimeFilled || !isPriceFilled || !isVehicleNameFilled) {
      const missing = [];
      if (!isStartingFromFilled) missing.push("Starting From");
      if (!isGoingToFilled) missing.push("Going To");
      if (!isDateFilled) missing.push("Date");
      if (!isTimeFilled) missing.push("Time");
      if (!isPriceFilled) missing.push("Price");
      if (!isVehicleNameFilled) missing.push("Vehicle Name");
      
      alert(`Please fill all required fields: ${missing.join(", ")}`);
      return;
    }

    setLoading(true);
    try {
      // 3. Before submitting ride: Add validation
      if (!startCoords || !endCoords) {
        alert("Please select both pickup and destination coordinates using the map or search result.");
        return;
      }

      // 5. Add console debug
      console.log("Start Coordinate Intel:", startCoords);
      console.log("End Coordinate Intel:", endCoords);

      // Safe resolution of coordinates before posting
      let sc = startCoords;
      let ec = endCoords;

      const payload = {
        ...formData,
        userId: localStorage.getItem('userId'),
        username: localStorage.getItem('username') || 'Current User',
        startingFrom: formData.startingFrom,
        goingTo: formData.goingTo,
        date: formData.date,
        time: formData.time || '09:00 AM',
        vehicleName: formData.vehicleName,
        price: formData.price,
        startLat: sc ? sc[0] : null,
        startLng: sc ? sc[1] : null,
        endLat: ec ? ec[0] : null,
        endLng: ec ? ec[1] : null,
        // 4. Ensure payload uses these safely (Already done in previous version, reinforcing here)
        startCoords: sc,
        endCoords: ec,
        isRoundTrip: formData.isRoundTrip,
        returnDate: formData.returnDate,
        returnTime: formData.returnTime,
        returnPrice: formData.returnPrice
      };

      console.log('Posting ride with payload:', payload);

      console.log("API CALL:", `${API_BASE_URL}/api/post-ride`, 'POST');
      const response = await fetch(`${API_BASE_URL}/api/post-ride`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      console.log('Post Ride Response:', data);

      if (response.ok && data.success) {
        alert('Ride posted successfully!');
        navigate('/user/home', { state: { activeTab: 'my-rides' } }); 
      } else {
        alert(data.message || 'Failed to post ride');
      }
    } catch (error) {
      console.error('Error posting ride:', error);
      alert(`Server error: ${error.message || 'Check connection'}`);
    } finally {
      setLoading(false);
    }
  };

  // Standardized Role-Based Control
  const isDriver = userData?.role === "driver";
  const isBanned = userData?.isBanned;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-6 py-12 pb-32">
        <header className="flex flex-col gap-1 mb-12">
          <h1 className="text-4xl font-black uppercase tracking-tighter text-black">Offer a Ride</h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.4em]">Strategic Route Deployment</p>
        </header>

        {/* Banned Alert */}
        {isBanned && (
          <div className="bg-black p-8 rounded-[2.5rem] text-white flex flex-col items-center text-center gap-4 mb-10">
            <div className="w-16 h-16 bg-red-600 rounded-3xl flex items-center justify-center text-2xl animate-pulse">🚫</div>
            <div className="space-y-1">
              <p className="text-sm font-black uppercase tracking-tight text-red-500">Account Restricted</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest max-w-[400px]">
                Reason: {userData.banReason || "Policy Violation Detail Pending"}
              </p>
            </div>
          </div>
        )}

        {/* Locked UI for non-drivers */}
        {!isDriver && !isBanned && (
          <div className="bg-red-50 p-8 rounded-[2.5rem] border border-red-100 flex flex-col items-center text-center gap-4 mb-20 animate-in fade-in zoom-in duration-500">
            <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-2xl shadow-sm">🔒</div>
            <div className="space-y-1">
              <p className="text-sm font-black text-black uppercase tracking-tight">Security Lockdown</p>
              <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest max-w-[280px]">
                You must be verified as a driver to access this tactical deployment zone.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
        </div>

        {/* Preview Map */}
        <div className="w-full h-[30vh] min-h-[160px] bg-gray-50 rounded-[2.5rem] overflow-hidden border border-gray-100 shadow-xl shadow-gray-100 relative z-0">
          {!startCoords && !endCoords && !formData.startingFrom && !formData.goingTo ? (
             <div className="absolute inset-0 flex items-center justify-center bg-gray-50 text-[10px] font-black text-gray-300 uppercase tracking-widest">
              Set locations to see preview
            </div>
          ) : (
            <MapContainer 
               center={getMapCenter()} 
               zoom={13} 
               style={{ height: '100%', width: '100%' }}
               whenCreated={(map) => map.invalidateSize()}
            >
              <ChangeView startCoords={startCoords} endCoords={endCoords} routeData={routeData} />
              <TileLayer
                attribution='&copy; OSM'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {startCoords && isValidCoords(startCoords[0], startCoords[1]) && (
                <Marker position={startCoords} />
              )}
              {endCoords && isValidCoords(endCoords[0], endCoords[1]) && (
                <Marker position={endCoords} />
              )}
              {routeData && routeData.length > 0 && routeData.every(p => isValidCoords(p[0], p[1])) && (
                <Polyline pathOptions={{ color: '#10b981', weight: 4, lineJoin: 'round' }} positions={routeData} />
              )}
            </MapContainer>
          )}
        </div>

        <form onSubmit={handlePostRide} className="space-y-10">

          {/* Route Section */}
          <section className="space-y-6">
            <h2 className="text-[10px] font-black text-black uppercase tracking-widest border-b border-gray-50 pb-2">Route Details</h2>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Starting From</label>
                <div className="relative group">
                  <input
                    type="text"
                    name="startingFrom"
                    placeholder="e.g., Campus"
                    value={formData.startingFrom}
                    onChange={handleChange}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleMapIconClick('startingFrom'); } }}
                    className="w-full px-6 py-4 bg-gray-50 border border-transparent rounded-[1.5rem] text-sm font-bold focus:outline-none focus:bg-white focus:border-black transition-all pr-12"
                  />
                  <button type="button" onClick={() => handleMapIconClick('startingFrom')} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-gray-300 hover:text-black hover:bg-gray-100 rounded-2xl transition-all">📍</button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Going To</label>
                <div className="relative group">
                  <input
                    type="text"
                    name="goingTo"
                    placeholder="e.g., Calicut Beach"
                    value={formData.goingTo}
                    onChange={handleChange}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleMapIconClick('goingTo'); } }}
                    className="w-full px-6 py-4 bg-gray-50 border border-transparent rounded-[1.5rem] text-sm font-bold focus:outline-none focus:bg-white focus:border-black transition-all pr-12"
                  />
                  <button type="button" onClick={() => handleMapIconClick('goingTo')} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-gray-300 hover:text-black hover:bg-gray-100 rounded-2xl transition-all">📍</button>
                </div>
              </div>

              {distance && (
                <div className="flex items-center gap-2 px-1 py-1">
                  <div className="h-px flex-1 bg-gray-100"></div>
                  <span className="text-[10px] font-black text-black uppercase tracking-[0.2em] whitespace-nowrap bg-gray-50 px-4 py-2 rounded-full border border-gray-100">
                    Distance: {distance} km
                  </span>
                  <div className="h-px flex-1 bg-gray-100"></div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Departure Date</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  className="w-full px-6 py-4 bg-gray-50 border border-transparent rounded-[1.5rem] text-sm font-bold focus:outline-none focus:bg-white focus:border-black transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Departure Time</label>
                <input
                  type="time"
                  name="time"
                  value={formData.time}
                  onChange={handleChange}
                  className="w-full px-6 py-4 bg-gray-50 border border-transparent rounded-[1.5rem] text-sm font-bold focus:outline-none focus:bg-white focus:border-black transition-all"
                />
              </div>
            </div>
          </section>

          {/* Preferences Section */}
          <section className="space-y-6">
            <h2 className="text-[10px] font-black text-black uppercase tracking-widest border-b border-gray-50 pb-2">Preferences & Vehicle</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Seats Available</label>
                <select
                  name="passengers"
                  value={formData.passengers}
                  onChange={handleChange}
                  className="w-full px-6 py-4 bg-gray-50 border border-transparent rounded-[1.5rem] text-sm font-bold focus:outline-none focus:bg-white focus:border-black transition-all appearance-none"
                >
                  {[1, 2, 3, 4, 5, 6].map((num) => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Preference</label>
                <select
                  name="passengerPreference"
                  value={formData.passengerPreference}
                  onChange={handleChange}
                  className="w-full px-6 py-4 bg-gray-50 border border-transparent rounded-[1.5rem] text-sm font-bold focus:outline-none focus:bg-white focus:border-black transition-all appearance-none"
                >
                  <option value="Any">Any</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Vehicle Type</label>
                <select
                  name="vehicleType"
                  value={formData.vehicleType}
                  onChange={handleChange}
                  className="w-full px-6 py-4 bg-gray-50 border border-transparent rounded-[1.5rem] text-sm font-bold focus:outline-none focus:bg-white focus:border-black transition-all appearance-none"
                >
                  <option value="Bike">Bike</option>
                  <option value="Car">Car</option>
                  <option value="Auto">Auto</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Price (₹)</label>
                <input
                  type="number"
                  name="price"
                  placeholder="150"
                  value={formData.price}
                  onChange={handleChange}
                  className="w-full px-6 py-4 bg-gray-50 border border-transparent rounded-[1.5rem] text-sm font-bold focus:outline-none focus:bg-white focus:border-black transition-all"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Vehicle Name</label>
              <input
                type="text"
                name="vehicleName"
                placeholder="e.g., Swift"
                value={formData.vehicleName}
                onChange={handleChange}
                className="w-full px-6 py-4 bg-gray-50 border border-transparent rounded-[1.5rem] text-sm font-bold focus:outline-none focus:bg-white focus:border-black transition-all"
              />
            </div>
          </section>

          {/* Round Trip Section */}
          <section className="space-y-6 pb-4">
            <div className="flex items-center gap-3 ml-1">
              <input
                type="checkbox"
                id="isRoundTrip"
                name="isRoundTrip"
                checked={formData.isRoundTrip}
                onChange={handleChange}
                className="w-5 h-5 accent-black rounded border-gray-300 focus:ring-black"
              />
              <label htmlFor="isRoundTrip" className="text-[10px] font-black text-black uppercase tracking-widest cursor-pointer">Round Trip</label>
            </div>

            {formData.isRoundTrip && (
              <div className="bg-gray-50 p-8 rounded-[2rem] border border-gray-100 space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                <h3 className="text-[10px] font-black text-black uppercase tracking-[0.2em] opacity-40">Return Trip Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Return Date</label>
                    <input
                      type="date"
                      name="returnDate"
                      value={formData.returnDate}
                      onChange={handleChange}
                      className="w-full px-6 py-4 bg-white border border-transparent rounded-[1.5rem] text-sm font-bold focus:outline-none focus:border-black transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Return Time</label>
                    <input
                      type="time"
                      name="returnTime"
                      value={formData.returnTime}
                      onChange={handleChange}
                      className="w-full px-6 py-4 bg-white border border-transparent rounded-[1.5rem] text-sm font-bold focus:outline-none focus:border-black transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Return Price (₹)</label>
                  <input
                    type="number"
                    name="returnPrice"
                    placeholder="150"
                    value={formData.returnPrice}
                    onChange={handleChange}
                    className="w-full px-6 py-4 bg-white border border-transparent rounded-[1.5rem] text-sm font-bold focus:outline-none focus:border-black transition-all"
                  />
                </div>
              </div>
            )}
          </section>

                <button
                  type="submit"
                  disabled={loading || !isDriver || isBanned}
                  className={`w-full py-6 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3
                    ${loading || !isDriver || isBanned ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-black text-white shadow-2xl shadow-gray-200 active:scale-[0.98]'}`}
                >
                  {loading ? 'Initializing Route...' : isBanned ? 'Access Denied' : isDriver ? 'Post Ride' : 'Verification Required'}
                </button>
        </form>
      </div>
    </div>
  );
}

export default PostPage;
