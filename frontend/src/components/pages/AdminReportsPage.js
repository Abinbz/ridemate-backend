import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config/api';
import LoadingSpinner from '../shared/LoadingSpinner';
import { useToast } from '../../context/ToastContext';

function AdminReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { showToast } = useToast();

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/admin/reports`);
      const data = await res.json();
      if (data.success) {
        setReports(data.reports);
      } else {
        showToast(data.message || 'Failed to fetch reports', 'error');
      }
    } catch (err) {
      showToast('Backend connection error', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-black tracking-tight">User Reports</h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
            Monitor and resolve community concerns
          </p>
        </div>
        <div className="bg-black text-white px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest">
          {reports.length} Total Cases
        </div>
      </div>

      <div className="grid gap-6">
        {reports.length > 0 ? (
          reports.map((report) => (
            <div key={report.id} className="bg-white border border-gray-100 p-8 rounded-[2.5rem] hover:shadow-xl hover:shadow-gray-100 transition-all group">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-4 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-red-50 text-red-600 text-[8px] font-black uppercase tracking-widest rounded-full border border-red-100">
                      {report.reason}
                    </span>
                    <span className={`px-3 py-1 text-[8px] font-black uppercase tracking-widest rounded-full border ${
                      report.status === 'pending' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' : 'bg-green-50 text-green-600 border-green-100'
                    }`}>
                      {report.status}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-2xl border border-transparent group-hover:border-gray-100 transition-colors">
                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Reporter</p>
                      <p className="text-xs font-black text-black">{report.reporterName || 'Unknown'}</p>
                      <p className="text-[9px] font-bold text-gray-400 truncate">{report.reporterId}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl border border-transparent group-hover:border-gray-100 transition-colors">
                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Reported User</p>
                      <p className="text-xs font-black text-black">{report.reportedName || 'Unknown'}</p>
                      <p className="text-[9px] font-bold text-gray-400 truncate">{report.reportedId}</p>
                    </div>
                  </div>

                  <div className="p-6 border border-gray-50 rounded-3xl italic text-xs font-bold text-gray-600 leading-relaxed bg-white">
                    "{report.details || 'No additional details provided.'}"
                  </div>

                  <div className="flex items-center gap-4 text-[9px] font-black text-gray-300 uppercase tracking-widest">
                    <span>Case ID: {report.id}</span>
                    <span>•</span>
                    <span>Date: {new Date(report.createdAt).toLocaleDateString()}</span>
                    {report.rideId && (
                      <>
                        <span>•</span>
                        <button 
                          onClick={() => navigate(`/admin/ride/${report.rideId}`)}
                          className="text-black hover:underline"
                        >
                          View Ride Context
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-row md:flex-col gap-2">
                  <button 
                    onClick={() => showToast('Action not implemented in demo', 'info')}
                    className="flex-1 md:flex-none px-6 py-3 bg-black text-white text-[9px] font-black uppercase tracking-widest rounded-2xl hover:scale-105 active:scale-95 transition-all"
                  >
                    Take Action
                  </button>
                  <button 
                    onClick={() => showToast('Report dismissed', 'success')}
                    className="flex-1 md:flex-none px-6 py-3 border border-gray-100 text-gray-400 text-[9px] font-black uppercase tracking-widest rounded-2xl hover:bg-gray-50 transition-all"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="py-32 text-center border-2 border-dashed border-gray-50 rounded-[3rem]">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-xs font-black text-gray-300 uppercase tracking-widest">All clear. No active reports.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminReportsPage;
