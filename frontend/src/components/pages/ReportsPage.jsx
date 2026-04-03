// import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config/api';
import LoadingSpinner from '../shared/LoadingSpinner';

function ReportsPage() {
  const navigate = useNavigate();
  const [reportsGiven, setReportsGiven] = useState([]);
  const [reportsReceived, setReportsReceived] = useState([]);
  const [loading, setLoading] = useState(true);
  const userId = localStorage.getItem('userId');

  const fetchReports = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const url = `${API_BASE_URL}/api/reports/user/${userId}`;
      console.log("API CALL:", url, 'GET');
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setReportsGiven(data.given || []);
        setReportsReceived(data.received || []);
      }
    } catch (err) {
      console.error('Fetch reports error:', err);
      // Silent error for UX but log it
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="bg-white border-b border-gray-50 px-6 py-6 flex items-center gap-4 sticky top-0 z-50">
          <button onClick={() => navigate(-1)} className="text-black hover:opacity-50 transition-opacity">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-sm font-black text-black uppercase tracking-widest">Reports</h1>
        </div>
        <LoadingSpinner />
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
        <h1 className="text-sm font-black text-black uppercase tracking-widest">Reports</h1>
      </div>

      <div className="max-w-xl mx-auto px-6 py-12 space-y-16">
        
        {/* Reports Given */}
        <section className="space-y-8">
           <div className="flex items-baseline justify-between border-b border-gray-50 pb-4">
              <h2 className="text-[10px] font-black text-black uppercase tracking-[0.2em]">Reports Given By You</h2>
              <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">{reportsGiven.length} Total</span>
           </div>
           <div className="space-y-6">
              {reportsGiven.length > 0 ? (
                reportsGiven.map((item) => (
                  <div key={item.id} className="p-8 border border-gray-100 rounded-[2.5rem] hover:bg-gray-50 transition-colors group">
                     {/* ... card content ... */}
                     <div className="flex items-start justify-between mb-6">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 bg-black text-white rounded-2xl flex items-center justify-center text-xs font-black group-hover:scale-95 transition-transform">
                             {item.reportedName?.[0] || 'R'}
                           </div>
                            <div>
                              <p className="text-xs font-black text-black leading-none mb-1">Reported {item.reportedName}</p>
                              <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">{new Date(item.createdAt).toLocaleDateString()}</p>
                            </div>
                        </div>
                        <span className="px-3 py-1 bg-black text-white text-[8px] font-black uppercase tracking-widest rounded-full leading-none">
                          {item.reason}
                        </span>
                     </div>
                     <p className="text-xs font-bold text-black leading-relaxed italic border-l-2 border-black pl-4 py-1">
                       &quot;{item.details}&quot;
                     </p>
                  </div>
                ))
              ) : (
                <div className="py-20 text-center border-2 border-dashed border-gray-50 rounded-[2.5rem]">
                  <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">No reports given yet</p>
                </div>
              )}
           </div>
        </section>

        {/* Reports Received */}
        <section className="space-y-8">
           <div className="flex items-baseline justify-between border-b border-gray-50 pb-4">
              <h2 className="text-[10px] font-black text-black uppercase tracking-[0.2em]">Reports Received</h2>
              <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">{reportsReceived.length} Total</span>
           </div>
           <div className="space-y-6">
              {reportsReceived.length > 0 ? (
                reportsReceived.map((item) => (
                  <div key={item.id} className="p-8 border border-gray-100 rounded-[2.5rem] hover:bg-gray-50 transition-colors group">
                     {/* ... card content ... */}
                     <div className="flex items-start justify-between mb-6">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 bg-gray-50 text-black border border-gray-100 rounded-2xl flex items-center justify-center text-xs font-black group-hover:scale-95 transition-transform">
                             {item.reporterName?.[0] || 'R'}
                           </div>
                            <div>
                              <p className="text-xs font-black text-black leading-none mb-1">{item.reporterName} reported you</p>
                              <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">{new Date(item.createdAt).toLocaleDateString()}</p>
                            </div>
                        </div>
                        <span className="px-3 py-1 border border-black text-black text-[8px] font-black uppercase tracking-widest rounded-full leading-none">
                          {item.reason}
                        </span>
                     </div>
                     <p className="text-xs font-bold text-black leading-relaxed italic border-l-2 border-gray-100 pl-4 py-1">
                       &quot;{item.details}&quot;
                     </p>
                  </div>
                ))
              ) : (
                <div className="py-20 text-center border-2 border-dashed border-gray-50 rounded-[2.5rem]">
                  <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">No reports received yet</p>
                </div>
              )}
           </div>
        </section>

      </div>
    </div>
  );
}

export default ReportsPage;
