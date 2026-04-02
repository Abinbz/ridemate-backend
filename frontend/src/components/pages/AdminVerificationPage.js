import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../config/api';

const AdminVerificationPage = () => {
    const [verifications, setVerifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDoc, setSelectedDoc] = useState(null);

    useEffect(() => {
        fetchVerifications();
    }, []);

    const fetchVerifications = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/verifications`);
            const data = await response.json();
            if (data.success) {
                setVerifications(data.verifications || []);
            }
        } catch (error) {
            console.error('Error fetching verifications:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (userId, action) => {
        try {
            const endpoint = action === 'approve' ? 'verify' : 'reject';
            const response = await fetch(`${API_BASE_URL}/api/admin/${endpoint}/${userId}`, {
                method: 'POST'
            });
            const data = await response.json();
            if (data.success) {
                // Refresh list
                fetchVerifications();
            }
        } catch (error) {
            console.error(`Error ${action}ing verification:`, error);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-700">
            <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-black tracking-tighter text-black uppercase">Validation Chamber</h2>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">KYC Approval System</p>
            </div>

            <div className="space-y-4">
                {verifications.length > 0 ? (
                    verifications.map((v) => (
                        <div key={v.userId} className="bg-white border border-gray-100 p-6 rounded-[2.5rem] shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-black text-white rounded-2xl flex items-center justify-center text-lg font-black shadow-lg shadow-gray-200 group-hover:scale-110 transition-transform duration-500">
                                        {v.userName ? v.userName[0].upper() : 'U'}
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-black leading-none uppercase tracking-tight">{v.userName || 'Anonymous Entity'}</h3>
                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">{v.userEmail}</p>
                                    </div>
                                </div>
                                <span className={`text-[8px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-sm shadow-gray-200 border border-gray-50 bg-white
                                    ${v.status === 'pending' ? 'text-amber-500' : v.status === 'approved' ? 'text-emerald-500' : 'text-red-500'}`}>
                                    {v.status || 'Checking'}
                                </span>
                            </div>

                            <div className="grid grid-cols-3 gap-2 mb-6">
                                {[
                                    { key: 'licenseUrl', label: 'License' },
                                    { key: 'rcUrl', label: 'Vehicle RC' },
                                    { key: 'insuranceUrl', label: 'Insurance' }
                                ].map((doc) => (
                                    <button 
                                        key={doc.key}
                                        onClick={() => window.open(v[doc.key], '_blank')}
                                        className="py-3 bg-gray-50 border border-transparent rounded-2xl flex flex-col items-center justify-center gap-1 hover:bg-black hover:text-white transition-all group/doc"
                                    >
                                        <p className="text-[7px] font-black uppercase tracking-widest leading-none text-gray-400 group-hover/doc:text-white/60">{doc.label}</p>
                                        <p className="text-[9px] font-bold uppercase tracking-tight">View</p>
                                    </button>
                                ))}
                            </div>

                            {v.status === 'pending' && (
                                <div className="flex gap-2 animate-in slide-in-from-bottom-2 duration-500">
                                    <button 
                                        onClick={() => handleAction(v.userId, 'reject')}
                                        className="flex-1 py-3.5 mb-2 bg-gray-50 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] rounded-2xl hover:text-red-500 transition-all border border-transparent hover:border-red-100"
                                    >
                                        Reject Entry
                                    </button>
                                    <button 
                                        onClick={() => handleAction(v.userId, 'approve')}
                                        className="flex-1 py-3.5 mb-2 bg-black text-[9px] font-black text-white uppercase tracking-[0.2em] rounded-2xl hover:bg-gray-900 active:scale-95 transition-all shadow-lg shadow-gray-200"
                                    >
                                        Validate Access
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="py-20 text-center border-2 border-dashed border-gray-100 rounded-[3rem]">
                        <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest leading-none animate-pulse">Zero Authentications Pending</p>
                    </div>
                )}
            </div>

            {/* Lightbox Preview */}
            {selectedDoc && (
                <div 
                    className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-in fade-in duration-300"
                    onClick={() => setSelectedDoc(null)}
                >
                    <div className="relative max-w-full max-h-[80vh] overflow-hidden rounded-[3rem] animate-in zoom-in-95 duration-500 border border-white/10 shadow-2xl">
                        <img 
                            src={selectedDoc} 
                            alt="Document Preview" 
                            className="w-full h-full object-contain"
                        />
                        <button className="absolute top-6 right-6 w-12 h-12 bg-white text-black rounded-full flex items-center justify-center font-black transition-transform hover:scale-110 active:scale-90">
                            ✕
                        </button>
                    </div>
                    <p className="mt-8 text-[10px] font-black text-white uppercase tracking-[0.3em]">Authorized Document Preview</p>
                </div>
            )}
        </div>
    );
};

export default AdminVerificationPage;
