/**
 * Utility for geocoding and coordinate validation to prevent map crashes.
 */

// Default center (Kerala, India)
export const DEFAULT_COORDS = [10.8505, 76.2711];

/**
 * Validates if the given coordinates are safe to use in a map.
 */
export const isValidCoords = (lat, lng) => {
  if (lat === undefined || lat === null || lng === undefined || lng === null) return false;
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);
  return !isNaN(latitude) && !isNaN(longitude) && 
         latitude >= -90 && latitude <= 90 && 
         longitude >= -180 && longitude <= 180;
};

/**
 * Converts a place name into [lat, lng] using OpenStreetMap Nominatim.
 */
export const getCoordinates = async (place) => {
  if (!place || typeof place !== 'string' || place.trim() === '') return null;
  
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(place)}&format=json&limit=1`);
    const data = await response.json();
    
    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      if (isValidCoords(lat, lon)) {
        return [lat, lon];
      }
    }
    return null;
  } catch (error) {
    console.error('Geocoding error for:', place, error);
    return null;
  }
};
