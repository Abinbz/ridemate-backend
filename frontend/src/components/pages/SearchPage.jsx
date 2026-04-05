import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import LoadingSpinner from '../shared/LoadingSpinner';
import { API_BASE_URL } from '../../config/api';
import { getCoordinates, isValidCoords, DEFAULT_COORDS } from '../../utils/geoUtils';


// Fix for Leaflet default marker icons in React
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

function SearchPage() {
  const { showToast } = useToast();

  const [searchData, setSearchData] = useState({
    startingFrom: '',
    goingTo: '',
    date: '',
    passengers: 1,
    passengerPreference: 'Any',
    vehiclePreference: 'Bike'
  });

  const [startCoords, setStartCoords] = useState(null);
  const [endCoords, setEndCoords] = useState(null);
  const [routeData, setRouteData] = useState([]);
  const [distance, setDistance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [upcomingRides, setUpcomingRides] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();

  const getMapCenter = () => {
    if (startCoords && isValidCoords(startCoords[0], startCoords[1])) return startCoords;
    if (endCoords && isValidCoords(endCoords[0], endCoords[1])) return endCoords;
    return DEFAULT_COORDS;
  };

  // Trigger route calculation automatically when both coords are set
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

  // Handle return from MapPicker
  useEffect(() => {
    if (location.state && location.state.selection) {
      const { type, lat, lng, name } = location.state.selection;
      const extra = location.state.extraState || {};

      // Merge extra state (from previously selected locations or typed data)
      if (extra.searchData) {
        setSearchData(prev => ({ ...prev, ...extra.searchData }));
      }
      if (extra.startCoords) {
        setStartCoords(extra.startCoords);
      }
      if (extra.endCoords) {
        setEndCoords(extra.endCoords);
      }

      // Finally, set the current selection
      if (type === 'start') {
        setSearchData(prev => ({ ...prev, startingFrom: name }));
        setStartCoords([lat, lng]);
      } else if (type === 'end') {
        setSearchData(prev => ({ ...prev, goingTo: name }));
        setEndCoords([lat, lng]);
      }

      // Clear state to avoid re-triggering on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Fetch real upcoming rides for the "Home" view
  useEffect(() => {
    const fetchHomeData = async () => {
      const userId = localStorage.getItem('userId');
      if (!userId) return;
      try {
        console.log("API CALL:", `${API_BASE_URL}/api/my-rides/${userId}`);
        const response = await fetch(`${API_BASE_URL}/api/my-rides/${userId}`);
        const data = await response.json();
        if (response.ok && data.success) {
          // Flatten upcoming posted and booked rides for a quick glance
          const allUpcoming = [
            ...(data.posted.upcoming || []),
            ...(data.booked.upcoming || [])
          ].slice(0, 5); // Limit to 5 for home preview
          setUpcomingRides(allUpcoming);
        }
      } catch (err) {
        console.error('Home data fetch error:', err);
        showToast(`Error: ${err.message}`, 'error');
      }
    };
    fetchHomeData();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSearchData({ ...searchData, [name]: value });
  };

  const handleInputClick = (name) => {
    const currentQuery = searchData[name];
    const type = name === 'startingFrom' ? 'start' : 'end';
    navigate(`/map-picker?type=${type}&query=${encodeURIComponent(currentQuery)}`, {
      state: {
        fromTab: 'search',
        extraState: {
          searchData,
          startCoords,
          endCoords
        }
      }
    });
  };


  const fetchRoute = async (start, end) => {
    try {
      const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`);
      const data = await response.json();
      if (data && data.routes && data.routes.length > 0) {
        return {
          coordinates: data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]),
          distance: (data.routes[0].distance / 1000).toFixed(2) // meters to km
        };
      }
      return null;
    } catch (error) {
      console.error('Routing error:', error);
      return null;
    }
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchData.startingFrom || !searchData.goingTo) {
      showToast('Please enter both pickup and destination locations.', 'error');
      return;
    }

    setLoading(true);

    // Cold start notification
    const warmupTimer = setTimeout(() => {
      showToast('Waking up server... please wait', 'info');
    }, 3000);

    // Ensure we have current coords
    let sc = startCoords;
    let ec = endCoords;

    if (!sc) {
      showToast('Resolving starting location...', 'info');
      sc = await getCoordinates(searchData.startingFrom);
    }
    if (!ec) {
      showToast('Resolving destination...', 'info');
      ec = await getCoordinates(searchData.goingTo);
    }

    if (!sc || !ec) {
      showToast('Could not resolve route points. Use the map picker for better accuracy.', 'error');
      setLoading(false);
      return;
    }

    // Set coords if they were fetched just now (user typed and hit search directly)
    if (!startCoords) setStartCoords(sc);
    if (!endCoords) setEndCoords(ec);

    let searchResponseData = null;
    try {
      const requestBody = {
        ...searchData,
        startingFrom: searchData.startingFrom.trim(),
        goingTo: searchData.goingTo.trim(),
        userId: localStorage.getItem('userId'),
        startLat: sc[0],
        startLng: sc[1],
        endLat: ec[0],
        endLng: ec[1]
      };
      console.log("API CALL:", `${API_BASE_URL}/api/search-rides`);
      const response = await fetch(`${API_BASE_URL}/api/search-rides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      const data = await response.json();
      if (response.ok && data.success) {
        searchResponseData = data;
      }
    } catch (err) {
      console.error('Search error:', err);
      showToast(`Server error: ${err.message || 'Check connection'}`, 'error');
    }

    // Keep loading for a moment for smooth transition
    setTimeout(() => {
      clearTimeout(warmupTimer);
      setLoading(false);
      navigate('/user/results', { state: { searchData, searchResponseData } });
    }, 1500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <LoadingSpinner />
        <p className="text-[10px] font-black text-black uppercase tracking-[0.2em] mt-4">Searching for rides...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-6 pt-4">
      <div className="max-w-md mx-auto px-4 space-y-6">

        {/* ── Minimalist Hero Section ── */}
        <div className="text-center pt-2">
          <h1 className="text-3xl font-black tracking-tighter text-black leading-none uppercase">
            Your journey.<br />
            <span className="text-gray-300">Simplified.</span>
          </h1>
        </div>

        {/* ── Search Card ── */}
        <div className="w-full bg-white border border-gray-200 rounded-xl shadow-sm p-5 text-left">
          <form onSubmit={handleSearch} className="flex flex-col gap-4">

            <div className="relative group">
              <input
                type="text"
                name="startingFrom"
                placeholder="Starting From"
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:border-black transition-all pr-12"
                value={searchData.startingFrom}
                onChange={handleChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleInputClick('startingFrom');
                  }
                }}
              />
              <button
                type="button"
                onClick={() => handleInputClick('startingFrom')}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-gray-300 hover:text-black hover:bg-gray-50 rounded-lg transition-all"
                title="Open Map Picker"
              >
                📍
              </button>
            </div>

            <div className="relative group">
              <input
                type="text"
                name="goingTo"
                placeholder="Going To"
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:border-black transition-all pr-12"
                value={searchData.goingTo}
                onChange={handleChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleInputClick('goingTo');
                  }
                }}
              />
              <button
                type="button"
                onClick={() => handleInputClick('goingTo')}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-gray-300 hover:text-black hover:bg-gray-50 rounded-lg transition-all"
                title="Open Map Picker"
              >
                📍
              </button>
            </div>

            {distance && (
              <div className="flex items-center gap-2 px-1 py-1 animate-in fade-in duration-500">
                <div className="h-px flex-1 bg-gray-100"></div>
                <span className="text-[10px] font-black text-black uppercase tracking-[0.2em] whitespace-nowrap bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                  Distance: {distance} km
                </span>
                <div className="h-px flex-1 bg-gray-100"></div>
              </div>
            )}

            <input
              type="date"
              name="date"
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:border-black transition-all"
              value={searchData.date}
              onChange={handleChange}
            />

            <select
              name="passengers"
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:border-black transition-all appearance-none bg-no-repeat bg-[position:calc(100%-1rem)_center] bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2212%22%20height%3D%228%22%20viewBox%3D%220%200%2012%208%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M1.41%200.589996L6%205.17L10.59%200.589996L12%202L6%208L0%202L1.41%200.589996Z%22%20fill%3D%22black%22%2F%3E%3C%2Fsvg%3E')]"
              value={searchData.passengers}
              onChange={handleChange}
            >
              {[1, 2, 3, 4, 5, 6].map(num => (
                <option key={num} value={num}>{num} {num === 1 ? 'Seat' : 'Seats'}</option>
              ))}
            </select>

            <select
              name="passengerPreference"
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:border-black transition-all appearance-none bg-no-repeat bg-[position:calc(100%-1rem)_center] bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2212%22%20height%3D%228%22%20viewBox%3D%220%200%2012%208%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M1.41%200.589996L6%205.17L10.59%200.589996L12%202L6%208L0%202L1.41%200.589996Z%22%20fill%3D%22black%22%2F%3E%3C%2Fsvg%3E')]"
              value={searchData.passengerPreference}
              onChange={handleChange}
            >
              <option value="Any">Preference: Any</option>
              <option value="Male">Preference: Male</option>
              <option value="Female">Preference: Female</option>
              <option value="Other">Preference: Other</option>
            </select>

            <select
              name="vehiclePreference"
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-sm text-black focus:outline-none focus:border-black transition-all appearance-none bg-no-repeat bg-[position:calc(100%-1rem)_center] bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2212%22%20height%3D%228%22%20viewBox%3D%220%200%2012%208%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M1.41%200.589996L6%205.17L10.59%200.589996L12%202L6%208L0%202L1.41%200.589996Z%22%20fill%3D%22black%22%2F%3E%3C%2Fsvg%3E')]"
              value={searchData.vehiclePreference}
              onChange={handleChange}
            >
              <option value="Bike">Vehicle: Bike</option>
              <option value="Car">Vehicle: Car</option>
              <option value="Auto">Vehicle: Auto</option>
              <option value="Bus">Vehicle: Bus</option>
            </select>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white px-6 py-3 mt-2 rounded-lg text-sm font-semibold active:scale-[0.98] transition-all disabled:bg-gray-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
              ) : 'Search Rides'}
            </button>
          </form>
        </div>

        {/* ── Map ── */}
        <div className="w-full h-[35vh] min-h-[180px] rounded-[2.5rem] overflow-hidden shadow-xl shadow-gray-100 border border-gray-100 relative z-0">
          {(!startCoords && !endCoords && !searchData.startingFrom && !searchData.goingTo) ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 text-[10px] font-black text-gray-300 uppercase tracking-widest">
              Enter locations to view map
            </div>
          ) : (
            <MapContainer 
              center={getMapCenter()} 
              zoom={13} 
              style={{ height: '100%', width: '100%' }}
              whenCreated={(mapInstance) => { mapInstance.invalidateSize(); }}
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

        {/* ── Upcoming Rides ── */}
        {upcomingRides.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black tracking-tighter text-black uppercase">Upcoming</h2>
              <button
                onClick={() => navigate('/user/home', { state: { activeTab: 'my-rides' } })}
                className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-black transition-colors"
              >
                View All &rarr;
              </button>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide -mx-2 px-2">
              {upcomingRides.map((ride, i) => (
                <div
                  key={ride.id || i}
                  onClick={() => navigate('/user/my-rides/details', { state: { ride } })}
                  className="min-w-[200px] border border-gray-100 p-5 rounded-2xl hover:border-black transition-all group shrink-0 cursor-pointer"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-black text-white rounded-xl flex items-center justify-center text-xs font-black">
                      {(ride?.driver?.name || (typeof ride?.driver === 'string' ? ride.driver : (ride.role || 'R')))[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-black text-black leading-none">{ride?.driver?.name || (typeof ride?.driver === 'string' ? ride.driver : (ride.role === 'Driver' ? 'You' : 'Driver'))}</p>
                      <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mt-0.5">{ride.time || ride.date}</p>
                    </div>
                  </div>
                  <div className="space-y-1 mb-4 text-[10px] font-bold text-gray-500 uppercase tracking-tight">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-black"></div>
                      <span className="truncate">{ride.from}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full border border-black bg-white"></div>
                      <span className="truncate">{ride.to}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-gray-50 pt-3">
                    <span className="text-[8px] font-bold text-gray-300 uppercase tracking-widest">per seat</span>
                    <span className="text-base font-black text-black">{ride.price}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Stacked Sidebar / Details ── */}
        <div className="space-y-6 pt-4 border-t border-gray-100">

          <div className="bg-black p-8 rounded-[2.5rem] text-white shadow-2xl shadow-gray-200">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-2">Offer a Ride</h3>
            <p className="text-[10px] text-gray-400 font-bold leading-relaxed mb-6 uppercase tracking-widest opacity-60">Split the cost of your commute with fellow students.</p>
            <button 
              onClick={() => navigate('/user/post')}
              className="w-full bg-white text-black py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-gray-100 active:scale-[0.98] transition-all"
            >
              Post Now
            </button>
          </div>

          {/* Profile Glance */}
          <div className="border border-gray-100 p-8 rounded-[2.5rem] space-y-6 bg-white shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-black text-white rounded-2xl flex items-center justify-center font-black shadow-lg">A</div>
              <div>
                <p className="text-sm font-black text-black leading-none mb-1">Abin</p>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-[.2em]">Verified Student</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pb-2 border-b border-gray-50">
              <div>
                <p className="text-sm font-black text-black">4.8</p>
                <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">Rating</p>
              </div>
              <div>
                <p className="text-sm font-black text-black">23</p>
                <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">Rides</p>
              </div>
            </div>

            {/* CO2 Impact */}
            <div className="space-y-2 pt-1">
              <div className="flex justify-between items-end">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.1em]">CO&sup2; Saved</span>
                <span className="text-xs font-black text-black">12.4 kg</span>
              </div>
              <div className="w-full h-1 bg-gray-50 rounded-full overflow-hidden">
                <div className="h-full bg-black rounded-full" style={{ width: '62%' }}></div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

export default SearchPage;
