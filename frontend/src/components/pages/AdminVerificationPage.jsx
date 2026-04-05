import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../config/api';

const AdminVerificationPage = () => {
    const [verifications, setVerifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedUser, setExpandedUser] = useState(null);
    const [decisions, setDecisions] = useState({});
    const [message, setMessage] = useState({ text: '', type: '' });

    useEffect(() => {
        fetchVerifications();
    }, []);

    const fetchVerifications = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            console.log("Fetching pending verifications...");
            
            const response = await fetch(`${API_BASE_URL}/api/admin/verifications`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error("Failed to parse verifications JSON:", text);
                throw new Error("Invalid server response format");
            }

            if (data.success) {
                setVerifications(data.verifications || []);
                const initialDecisions = {};
                data.verifications.forEach(v => {
                    initialDecisions[v.userId] = {
                        documents: {
                            license: { 
                                status: v.documents?.license?.status || 'pending', 
                                reason: v.documents?.license?.reason || '' 
                            },
                            rc: { 
                                status: v.documents?.rc?.status || 'pending', 
                                reason: v.documents?.rc?.reason || '' 
                            },
                            insurance: { 
                                status: v.documents?.insurance?.status || 'pending', 
                                reason: v.documents?.insurance?.reason || '' 
                            }
                        },
                        promoteToDriver: v.role === 'driver'
                    };
                });
                setDecisions(initialDecisions);
                console.log("Verifications loaded:", data.verifications.length);
            }
        } catch (error) {
            console.error('Error fetching verifications:', error);
            setMessage({ text: 'Failed to load verifications', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (userId, docType, status) => {
        try {
            console.log(`📡 Updating ${docType} to ${status}...`);
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/admin/verify-document/${userId}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ type: docType, status })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.user) {
                    // Optimized Local State Update: No full list refresh
                    setVerifications(prev => prev.map(u => u.userId === userId ? { ...u, documents: data.user.documents } : u));
                    
                    // Update the decisions map as well
                    setDecisions(prev => ({
                        ...prev,
                        [userId]: {
                            ...prev[userId],
                            documents: {
                                license: { status: data.user.documents?.license?.status || 'pending', reason: data.user.documents?.license?.reason || '' },
                                rc: { status: data.user.documents?.rc?.status || 'pending', reason: data.user.documents?.rc?.reason || '' },
                                insurance: { status: data.user.documents?.insurance?.status || 'pending', reason: data.user.documents?.insurance?.reason || '' }
                            }
                        }
                    }));
                    setMessage({ text: `${docType.toUpperCase()} status updated`, type: 'success' });
                }
            } else {
                throw new Error("Update failed on server. Code: " + response.status);
            }
        } catch (error) {
            console.error('Status update error:', error);
            setMessage({ text: 'Failed to update document status', type: 'error' });
        }
    };

    const updateReason = async (userId, docType, reason) => {
        // We can keep reason local until status change or finalize, 
        // but let's make it persistent if it's rejected
        setDecisions(prev => ({
            ...prev,
            [userId]: {
                ...prev[userId],
                documents: {
                    ...prev[userId].documents,
                    [docType]: { ...prev[userId].documents[docType], reason }
                }
            }
        }));
    };

    const togglePromote = (userId) => {
        setDecisions(prev => ({
            ...prev,
            [userId]: {
                ...prev[userId],
                promoteToDriver: !prev[userId].promoteToDriver
            }
        }));
    };

    const handleSubmit = async (userId) => {
        const userDecision = decisions[userId];
        const token = localStorage.getItem('token');
        
        console.log("Finalizing decision for user:", userId, userDecision);
        
        const rejectedDocs = Object.entries(userDecision.documents).filter(([_, doc]) => doc.status === 'rejected');
        const missingReasons = rejectedDocs.some(([_, doc]) => !doc.reason.trim());
        
        if (missingReasons) {
            setMessage({ text: 'Please provide a reason for all rejected documents', type: 'error' });
            return;
        }

        const allApproved = Object.values(userDecision.documents).every(doc => doc.status === 'approved');
        if (userDecision.promoteToDriver && !allApproved) {
            setMessage({ text: 'Promote as Driver is only allowed if ALL documents are approved', type: 'error' });
            return;
        }

        try {
            setLoading(true);
            const response = await fetch(`${API_BASE_URL}/api/admin/finalize-verification/${userId}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    documents: userDecision.documents,
                    promoteToDriver: userDecision.promoteToDriver
                }),
            });

            const text = await response.text();
            console.log("Raw response from finalize:", text);

            let data;
            try {
                data = JSON.parse(text);
            } catch (err) {
                console.error("Finalize JSON parse error. Raw text:", text);
                throw new Error("Server returned non-JSON response");
            }

            if (data.success) {
                setMessage({ text: 'Decision finalized successfully', type: 'success' });
                // Synchronization: Refetch the list to ensure all state is current and promoted user is updated.
                await fetchVerifications();
                setExpandedUser(null);
                setTimeout(() => setMessage({ text: '', type: '' }), 3000);
            } else {
                throw new Error(data.message || 'Verification failed');
            }
        } catch (error) {
            console.error('Finalize execution error:', error);
            setMessage({ text: error.message || 'Connection fault during finalization', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'verified': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            case 'rejected': return 'bg-red-50 text-red-600 border-red-100';
            default: return 'bg-amber-50 text-amber-600 border-amber-100';
        }
    };

    const getStatusIndicator = (status) => {
        switch (status) {
            case 'approved': return '✔ Approved';
            case 'rejected': return '❌ Rejected';
            case 'pending': return '⏳ Pending';
            default: return '⏳ Pending';
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse">Syncing Validation Data...</p>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-8 pb-32">
            <header className="space-y-1">
                <h1 className="text-3xl font-black tracking-tighter text-black uppercase leading-none">Validation Central</h1>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em]">Advanced Driver Compliance System</p>
            </header>

            {message.text && (
                <div className={`p-4 rounded-2xl border text-[11px] font-bold uppercase tracking-widest animate-in slide-in-from-top-4 duration-300 ${
                    message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-red-50 border-red-100 text-red-600'
                }`}>
                    {message.text}
                </div>
            )}

            <div className="grid gap-4">
                {verifications.length > 0 ? (
                    verifications.map((user) => {
                        const userDecision = decisions[user.userId] || { documents: {} };
                        const canBeDriver = 
                            userDecision.documents.license?.status === 'approved' &&
                            userDecision.documents.rc?.status === 'approved' &&
                            userDecision.documents.insurance?.status === 'approved';

                        return (
                            <div key={user.userId} 
                                className={`bg-white border rounded-[2.5rem] overflow-hidden transition-all duration-500 shadow-sm hover:shadow-xl ${
                                    expandedUser === user.userId ? 'border-black ring-1 ring-black/5' : 'border-gray-100'
                                }`}
                            >
                                {/* Card Header */}
                                <div 
                                    onClick={() => setExpandedUser(expandedUser === user.userId ? null : user.userId)}
                                    className="p-6 cursor-pointer flex items-center justify-between group"
                                >
                                    <div className="flex items-center gap-5">
                                        <div className="w-14 h-14 bg-black text-white rounded-[1.25rem] flex items-center justify-center text-xl font-black shadow-lg group-hover:scale-105 transition-transform">
                                            {user.username?.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="text-sm font-black text-black uppercase tracking-tight">{user.username}</h3>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">ID: {user.collegeId}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <span className={`px-4 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-widest ${getStatusBadgeClass(user.verificationStatus)}`}>
                                            {user.verificationStatus || 'Pending'}
                                        </span>
                                        <div className={`w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center transition-transform duration-500 ${expandedUser === user.userId ? 'rotate-180 bg-black text-white' : ''}`}>
                                            ▼
                                        </div>
                                    </div>
                                </div>

                                {/* Expandable Content */}
                                {expandedUser === user.userId && (
                                    <div className="px-6 pb-8 space-y-8 animate-in slide-in-from-top-4 duration-500">
                                        {/* Document Section */}
                                        <div className="grid gap-8 border-t border-gray-50 pt-8">
                                            {[
                                                { id: 'license', label: 'Driving License', url: user.documents?.license?.url },
                                                { id: 'rc', label: 'Registration (RC)', url: user.documents?.rc?.url },
                                                { id: 'insurance', label: 'Insurance Policy', url: user.documents?.insurance?.url }
                                            ].map((doc) => (
                                                <div key={doc.id} className="grid md:grid-cols-2 gap-6 items-start">
                                                    {/* Image Preview */}
                                                    <div className="relative aspect-video bg-gray-50 rounded-3xl overflow-hidden border border-gray-100 group/img">
                                                        {doc.url ? (
                                                            <>
                                                                <img src={doc.url} alt={doc.label} className="w-full h-full object-cover" />
                                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                                                    <button 
                                                                        onClick={() => window.open(doc.url, '_blank')}
                                                                        className="bg-white text-black px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transform translate-y-4 group-hover/img:translate-y-0 transition-transform"
                                                                    >
                                                                        View Full Rez
                                                                    </button>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-gray-300 uppercase tracking-widest">
                                                                No Image Uploaded
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Controls */}
                                                    <div className="space-y-4">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex justify-between items-center px-1">
                                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{doc.label} Status</span>
                                                                <span className={`text-[9px] font-black uppercase tracking-widest ${
                                                                    userDecision.documents[doc.id]?.status === 'approved' ? 'text-emerald-500' : 
                                                                    userDecision.documents[doc.id]?.status === 'rejected' ? 'text-red-500' : 'text-amber-500'
                                                                }`}>
                                                                    {getStatusIndicator(userDecision.documents[doc.id]?.status)}
                                                                </span>
                                                            </div>
                                                            <select 
                                                                value={userDecision.documents[doc.id]?.status || 'pending'}
                                                                onChange={(e) => updateStatus(user.userId, doc.id, e.target.value)}
                                                                className={`w-full border-none rounded-2xl px-5 py-4 text-[11px] font-bold focus:ring-2 ring-black transition-all appearance-none cursor-pointer ${
                                                                    userDecision.documents[doc.id]?.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 
                                                                    userDecision.documents[doc.id]?.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-gray-50'
                                                                }`}
                                                            >
                                                                <option value="pending">⏳ Pending Review</option>
                                                                <option value="approved">✅ Approve Document</option>
                                                                <option value="rejected">❌ Reject Document</option>
                                                            </select>
                                                        </div>

                                                        {userDecision.documents[doc.id]?.status === 'rejected' && (
                                                            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                                                <textarea
                                                                    placeholder="SPECIFY REJECTION REASON..."
                                                                    value={userDecision.documents[doc.id]?.reason || ''}
                                                                    onChange={(e) => updateReason(user.userId, doc.id, e.target.value)}
                                                                    className="w-full bg-red-50/50 border border-red-100 rounded-2xl px-5 py-4 text-[11px] font-bold focus:ring-1 ring-red-500 min-h-[80px] uppercase tracking-tight"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Action Bar */}
                                        <div className="border-t border-gray-50 pt-8 flex flex-col md:flex-row items-center justify-between gap-6">
                                            <div className="flex flex-col gap-2">
                                                <label className={`flex items-center gap-4 cursor-pointer group ${!canBeDriver ? 'opacity-40 cursor-not-allowed' : ''}`}>
                                                    <div className="relative">
                                                        <input 
                                                            type="checkbox"
                                                            checked={userDecision.promoteToDriver}
                                                            disabled={!canBeDriver}
                                                            onChange={() => togglePromote(user.userId)}
                                                            className="sr-only"
                                                        />
                                                        <div className={`w-12 h-6 rounded-full transition-colors duration-300 ${userDecision.promoteToDriver ? 'bg-black' : 'bg-gray-200'}`}></div>
                                                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 ${userDecision.promoteToDriver ? 'translate-x-6' : ''}`}></div>
                                                    </div>
                                                    <span className="text-[11px] font-black text-black uppercase tracking-widest transition-opacity">Promote as Driver</span>
                                                </label>
                                                {!canBeDriver && (
                                                    <p className="text-[9px] font-black text-red-500 uppercase tracking-widest pl-1 animate-pulse">
                                                        ⚠ All 3 documents must be approved for promotion
                                                    </p>
                                                )}
                                            </div>

                                            <button 
                                                onClick={() => handleSubmit(user.userId)}
                                                className="w-full md:w-auto px-12 py-5 bg-black text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-[1.5rem] hover:bg-gray-900 active:scale-[0.98] transition-all shadow-xl shadow-gray-200"
                                            >
                                                Finalize Decision
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <div className="py-24 text-center border-2 border-dashed border-gray-100 rounded-[3rem] bg-gray-50/30">
                        <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm text-3xl">🛡️</div>
                        <h3 className="text-sm font-black text-black uppercase tracking-widest mb-1">Queue Empty</h3>
                        <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">No validation requests currently pending.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminVerificationPage;
