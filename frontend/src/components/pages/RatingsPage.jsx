import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../shared/LoadingSpinner';
import { API_BASE_URL } from '../../config/api';

function RatingsPage() {
  const navigate = useNavigate();
  const [receivedRatings, setReceivedRatings] = useState([]);
  const [givenRatings, setGivenRatings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRatings = async () => {
      try {
        const userId = localStorage.getItem('userId');
        const url = `${API_BASE_URL}/api/ratings/${userId}`;
        console.log("API CALL:", url, 'GET');
        const response = await fetch(url);
        const data = await response.json();

        if (response.ok && data.success) {
          setReceivedRatings(data.received || []);
          setGivenRatings(data.given || []);
        }
      } catch (err) {
        console.error('Failed to fetch ratings:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRatings();
  }, []);

  const renderRatingStars = (count) => {
    return (
      <div className="flex gap-0.5">
        {[...Array(5)].map((_, i) => (
          <svg
            key={i}
            xmlns="http://www.w3.org/2000/svg"
            className={`h-3 w-3 ${i < count ? 'text-black' : 'text-gray-100'}`}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 .587l3.668 7.568 8.332 1.151-6.064 5.828 1.48 8.279-7.416-3.967-7.417 3.967 1.481-8.279-6.064-5.828 8.332-1.151z" />
          </svg>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="bg-white border-b border-gray-50 px-6 py-6 flex items-center gap-4 sticky top-0 z-50">
          <button onClick={() => navigate(-1)} className="text-black hover:opacity-50 transition-opacity">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-sm font-black text-black uppercase tracking-widest">Ratings & Reviews</h1>
        </div>
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-50 px-6 py-6 flex items-center gap-4 sticky top-0 z-50">
        <button onClick={() => navigate(-1)} className="text-black hover:opacity-50 transition-opacity">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-sm font-black text-black uppercase tracking-widest">Ratings & Reviews</h1>
      </div>

      <div className="max-w-xl mx-auto px-6 py-12 space-y-16">

        {/* Received Section */}
        <section className="space-y-8">
          <div className="flex items-baseline justify-between border-b border-gray-50 pb-4">
            <h2 className="text-[10px] font-black text-black uppercase tracking-[0.2em]">Received From Riders</h2>
            <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">{receivedRatings.length} Total</span>
          </div>

          {receivedRatings.length === 0 ? (
            <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest text-center py-6">No reviews yet</p>
          ) : (
            <div className="space-y-6">
              {receivedRatings.map((item) => (
                <div key={item.id} className="p-8 border border-gray-100 rounded-[2.5rem] hover:bg-gray-50 transition-colors group">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-black text-white rounded-2xl flex items-center justify-center text-xs font-black group-hover:scale-95 transition-transform">
                        {item.fromUserAvatar}
                      </div>
                      <p className="text-xs font-black text-black">{item.fromUserName}</p>
                    </div>
                    {renderRatingStars(item.rating)}
                  </div>
                  <p className="text-xs font-bold text-black leading-relaxed italic mb-4">&quot;{item.comment}&quot;</p>
                  <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest leading-none">{new Date(item.timestamp).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Given Section */}
        <section className="space-y-8">
          <div className="flex items-baseline justify-between border-b border-gray-50 pb-4">
            <h2 className="text-[10px] font-black text-black uppercase tracking-[0.2em]">Given To Others</h2>
            <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">{givenRatings.length} Total</span>
          </div>

          {givenRatings.length === 0 ? (
            <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest text-center py-6">No reviews yet</p>
          ) : (
            <div className="space-y-6">
              {givenRatings.map((item) => (
                <div key={item.id} className="p-8 border border-gray-100 rounded-[2.5rem] hover:bg-gray-50 transition-colors group">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-50 text-black border border-gray-100 rounded-2xl flex items-center justify-center text-xs font-black group-hover:scale-95 transition-transform">
                        {item.toUserAvatar}
                      </div>
                      <p className="text-xs font-black text-black">You rated {item.toUserName}</p>
                    </div>
                    {renderRatingStars(item.rating)}
                  </div>
                  <p className="text-xs font-bold text-black leading-relaxed italic mb-4">&quot;{item.comment}&quot;</p>
                  <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest leading-none">{new Date(item.timestamp).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}


export default RatingsPage;
