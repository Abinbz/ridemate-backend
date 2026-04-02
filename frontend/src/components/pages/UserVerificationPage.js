import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { API_BASE_URL } from '../../config/api';

const UserVerificationPage = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null); // 'pending', 'approved', 'rejected', null
    const [files, setFiles] = useState({
        license: null,
        rc: null,
        insurance: null
    });

    const [previews, setPreviews] = useState({
        license: null,
        rc: null,
        insurance: null
    });

    useEffect(() => {
        fetchStatus();
    }, []);

    const fetchStatus = async () => {
        try {
            const userId = localStorage.getItem('userId');
            if (!userId) return;
            const response = await fetch(`${API_BASE_URL}/api/user/verification/${userId}`);
            const data = await response.json();
            if (data.success && data.verification) {
                setStatus(data.verification.status);
            }
        } catch (error) {
            console.error('Error fetching verification status:', error);
        }
    };

    const handleFileChange = (e, type) => {
        const file = e.target.files[0];
        if (file) {
            setFiles(prev => ({ ...prev, [type]: file }));
            setPreviews(prev => ({ ...prev, [type]: URL.createObjectURL(file) }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!files.license || !files.rc || !files.insurance) {
            showToast('Please upload all required documents.', 'error');
            return;
        }

        setLoading(true);
        const formData = new FormData();
        const userId = localStorage.getItem('userId');
        formData.append('userId', userId);
        formData.append('license', files.license);
        formData.append('rc', files.rc);
        formData.append('insurance', files.insurance);

        try {
            const response = await fetch(`${API_BASE_URL}/api/upload-documents`, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();
            if (data.success) {
                showToast('Documents uploaded successfully!', 'success');
                setStatus('pending');
            } else {
                showToast(data.message || 'Upload failed.', 'error');
            }
        } catch (error) {
            showToast('Server error during upload.', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (status === 'pending') {
        return (
            <div className="min-h-screen bg-white p-6 flex flex-col items-center justify-center text-center space-y-6">
                <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-[2.5rem] flex items-center justify-center text-3xl shadow-xl shadow-amber-100/50 animate-pulse">
                    ⏳
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-black uppercase tracking-tighter">Verification Pending</h2>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest max-w-[240px] leading-relaxed">
                        Our moderators are currently reviewing your documents. You will be notified once the process is complete.
                    </p>
                </div>
                <button 
                    onClick={() => navigate('/user/home')}
                    className="px-8 py-4 bg-black text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl shadow-gray-200 transition-all active:scale-95"
                >
                    Return to Mission Hub
                </button>
            </div>
        );
    }

    if (status === 'approved') {
        return (
            <div className="min-h-screen bg-white p-6 flex flex-col items-center justify-center text-center space-y-6">
                <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-[2.5rem] flex items-center justify-center text-3xl shadow-xl shadow-emerald-100/50">
                    🛡️
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-black uppercase tracking-tighter text-emerald-600">Access Granted</h2>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest max-w-[240px] leading-relaxed">
                        Your identity has been verified. You now have full clearance to operate on the platform.
                    </p>
                </div>
                <button 
                    onClick={() => navigate('/user/home')}
                    className="px-8 py-4 bg-black text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl shadow-gray-200"
                >
                    Enter System
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white pb-24">
            <header className="p-6 pt-12 space-y-1">
                <h1 className="text-3xl font-black uppercase tracking-tighter text-black">KYC Portal</h1>
                <p className="text-[10px] font-bold text-gray-300 uppercase tracking-[0.3em]">Identity Authentication Required</p>
            </header>

            <form onSubmit={handleSubmit} className="px-6 space-y-8 max-w-xl mx-auto">
                <div className="space-y-6">
                    {[
                        { id: 'license', label: 'Driving License', sub: 'Front view focus' },
                        { id: 'rc', label: 'Vehicle RC', sub: 'Registration Certificate' },
                        { id: 'insurance', label: 'Insurance Policy', sub: 'Valid coverage document' }
                    ].map((doc) => (
                        <div key={doc.id} className="space-y-3">
                            <label className="block text-[10px] font-black text-black uppercase tracking-widest px-1">
                                {doc.label} <span className="text-gray-300 ml-1">[{doc.sub}]</span>
                            </label>
                            <label className={`relative block group cursor-pointer aspect-video rounded-[2.5rem] border-2 border-dashed transition-all overflow-hidden
                                ${previews[doc.id] ? 'border-black' : 'border-gray-100 hover:border-gray-300 bg-gray-50/30'}`}>
                                
                                {previews[doc.id] ? (
                                    <img src={previews[doc.id]} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                                        <div className="w-10 h-10 rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-lg shadow-sm">📤</div>
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Deploy Image</p>
                                    </div>
                                )}
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    onChange={(e) => handleFileChange(e, doc.id)}
                                />
                                {previews[doc.id] && (
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                         <p className="text-[9px] font-black text-white uppercase tracking-widest">Replace File</p>
                                    </div>
                                )}
                            </label>
                        </div>
                    ))}
                </div>

                {status === 'rejected' && (
                    <div className="bg-red-50 p-6 rounded-[2rem] border border-red-100 animate-in slide-in-from-bottom-2 duration-500">
                        <p className="text-[9px] font-black text-red-600 uppercase tracking-widest leading-relaxed">
                            Previous submission rejected. Please ensure all images are high-resolution and clearly legible before retrying.
                        </p>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className={`w-full py-6 rounded-[2.5rem] text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3
                        ${loading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-black text-white shadow-2xl shadow-gray-200 active:scale-[0.98]'}`}
                >
                    {loading ? (
                        <>
                            <div className="w-4 h-4 border-2 border-gray-300 border-t-white rounded-full animate-spin"></div>
                            Processing Intel...
                        </>
                    ) : (
                        'Finalize & Upload Documents'
                    )}
                </button>
            </form>
        </div>
    );
};

export default UserVerificationPage;
