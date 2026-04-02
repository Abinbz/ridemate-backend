import React, { useState, useEffect } from 'react';
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

  const getMapCenter = () => {
    if (startCoords && isValidCoords(startCoords[0], startCoords[1])) return startCoords;
    if (endCoords && isValidCoords(endCoords[0], endCoords[1])) return endCoords;
    return DEFAULT_COORDS;
  };

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

    if (!formData.startingFrom || !formData.goingTo || !formData.date || !formData.time || !formData.price || !formData.vehicleName) {
      alert('Please fill in all required fields (Starting From, Going To, Date, Time, Price, Vehicle Name).');
      return;
    }

    setLoading(true);
    try {
      // Safe resolution of coordinates before posting
      let sc = startCoords;
      let ec = endCoords;

      if (!sc) sc = await getCoordinates(formData.startingFrom);
      if (!ec) ec = await getCoordinates(formData.goingTo);

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
        endLng: ec ? ec[1] : null
      };

      console.log('Posting ride with payload:', payload);

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
      alert('Server not reachable. Check backend connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white px-6 py-12 pb-24">
      <div className="max-w-xl mx-auto space-y-12">
        <div className="text-center">
          <h1 className="text-3xl font-black tracking-tighter text-black uppercase leading-none">Post a Ride</h1>
          <p className="text-[10px] font-bold text-gray-300 uppercase tracking-[0.2em] mt-3 italic">
            Share your journey. Split the cost.
          </p>
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
            disabled={loading}
            className="w-full py-5 bg-black text-white rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-gray-900 active:scale-[0.98] transition-all disabled:bg-gray-200 mt-6"
          >
            {loading ? 'Processing...' : 'Post Ride Now'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default PostPage;
