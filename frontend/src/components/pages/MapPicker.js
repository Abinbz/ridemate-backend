import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { isValidCoords, DEFAULT_COORDS } from '../../utils/geoUtils';

// Fix for default marker icon in React Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Helper to center map when position changes
function RecenterMap({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position && isValidCoords(position.lat, position.lng)) {
      map.setView([position.lat, position.lng], map.getZoom());
    }
  }, [position, map]);
  return null;
}

function LocationMarker({ position, setPosition, setLocationName }) {
  useMapEvents({
    async click(e) {
      const { lat, lng } = e.latlng;
      setPosition({ lat, lng });
      
      // Reverse Geocoding
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
        const data = await response.json();
        if (data && data.display_name) {
          // Use a shorter name if possible (the first few parts of the address)
          const nameParts = data.display_name.split(', ');
          const shortName = nameParts.slice(0, 2).join(', ');
          setLocationName(shortName || data.display_name);
        }
      } catch (err) {
        console.error('Reverse geocoding error:', err);
      }
    },
  });

  return (position === null || !isValidCoords(position.lat, position.lng)) ? null : (
    <Marker position={[position.lat, position.lng]}></Marker>
  );
}

function MapPicker() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type') || 'start'; // 'start' or 'end'
  const query = searchParams.get('query') || '';

  const [position, setPosition] = useState({ lat: DEFAULT_COORDS[0], lng: DEFAULT_COORDS[1] });
  const [locationName, setLocationName] = useState('Select a location');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const forwardGeocode = async () => {
      if (!query || query.trim() === '') return;
      
      setLoading(true);
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`);
        const data = await response.json();
        
        if (data && data.length > 0) {
          const { lat, lon, display_name } = data[0];
          const newPos = { lat: parseFloat(lat), lng: parseFloat(lon) };
          setPosition(newPos);
          
          const nameParts = display_name.split(', ');
          const shortName = nameParts.slice(0, 2).join(', ');
          setLocationName(shortName || display_name);
        } else {
          alert('Location not found');
        }
      } catch (err) {
        console.error('Forward geocoding error:', err);
      } finally {
        setLoading(false);
      }
    };

    forwardGeocode();
  }, [query]);

  const handleConfirm = () => {
    console.log('Confirmed Selection:', { type, position, locationName });
    // Navigate back to user home with selection data, activeTab, and preserved extraState
    navigate('/user/home', { 
      state: { 
        selection: {
          type,
          lat: position.lat,
          lng: position.lng,
          name: locationName
        },
        activeTab: location.state?.fromTab || 'search',
        extraState: location.state?.extraState || {}
      } 
    });
  };

  return (
    <div className="h-screen w-full flex flex-col relative overflow-hidden bg-gray-50">
      {/* Map Area */}
      <div className="flex-1 w-full relative z-0">
        {isValidCoords(position.lat, position.lng) ? (
          <MapContainer 
            center={[position.lat, position.lng]} 
            zoom={13} 
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%' }}
            whenCreated={(mapInstance) => { mapInstance.invalidateSize(); }}
          >
            <TileLayer
              attribution='&copy; OSM contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <RecenterMap position={position} />
            <LocationMarker position={position} setPosition={setPosition} setLocationName={setLocationName} />
          </MapContainer>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 text-[10px] font-black text-gray-300 uppercase tracking-widest text-center px-12">
            Location resolution failed.<br/>Tap confirm to use default or try a different search.
          </div>
        )}
      </div>

      {/* Bottom Panel */}
      <div className="bg-white border-t border-gray-200 p-6 z-10 shadow-2xl safe-area-bottom">
        <div className="max-w-md mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                {type === 'start' ? 'Starting From' : 'Going To'}
              </h2>
              <p className="text-sm font-black text-black truncate pr-4">
                {loading ? 'Searching...' : locationName}
              </p>
            </div>
            <div className="w-10 h-10 bg-gray-50 rounded-2xl flex items-center justify-center text-black font-black text-xs shrink-0">
               📍
            </div>
          </div>
          
          <button 
            onClick={handleConfirm}
            disabled={loading}
            className="w-full bg-black text-white py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-gray-900 active:scale-[0.98] transition-all shadow-lg disabled:bg-gray-200"
          >
            Confirm Location
          </button>
        </div>
      </div>
      
      {/* Floating Status Header */}
      <div className="absolute top-6 left-6 right-6 z-10 pointer-events-none">
         <div className="max-w-md mx-auto bg-white/90 backdrop-blur-md border border-gray-100 p-4 rounded-[2rem] shadow-xl flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)} 
              className="w-8 h-8 bg-black rounded-xl flex items-center justify-center text-white pointer-events-auto hover:opacity-70 transition-opacity"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <p className="text-[10px] font-black text-black uppercase tracking-widest">
              {loading ? 'Locating...' : 'Move map or tap to pin'}
            </p>
         </div>
      </div>
    </div>
  );
}

export default MapPicker;
