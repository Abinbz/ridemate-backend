import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../config/api';

const AdminUsersPage = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const url = `${API_BASE_URL}/api/admin/users`;
            console.log("API CALL:", url, 'GET');
            const response = await fetch(url);
            const data = await response.json();
            if (data.success) {
                setUsers(data.users);
            }
        } catch (error) {
            console.error('Error fetching admin users:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (userId, payload) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/update-user-status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, ...payload })
            });
            const data = await response.json();
            if (data.success) {
                // Synchronization: Refetch the list to ensure all state is current
                await fetchUsers();
            }
        } catch (error) {
            console.error('Update status error:', error);
        }
    };

    const filteredUsers = Array.isArray(users) ? users.filter(user => 
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase())
    ) : [];

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse">Syncing Directory...</p>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-black tracking-tighter text-black uppercase">Directory</h2>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Manage Platform Stakeholders</p>
            </div>

            <div className="relative group">
                <input 
                    type="text" 
                    placeholder="Filter by name, username, or email..." 
                    className="w-full bg-gray-50 border-none rounded-[1.5rem] py-4 px-6 text-xs font-bold focus:ring-2 focus:ring-black transition-all outline-none"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <div className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => (
                        <div key={user.id} className="bg-white border border-gray-100 p-6 rounded-[2rem] shadow-sm hover:shadow-md transition-all flex flex-col gap-4 relative overflow-hidden group">
                            {/* Role Badge */}
                            <div className="absolute top-4 right-4">
                                <span className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${user.role === 'admin' ? 'bg-black text-white' : 'bg-gray-100 text-gray-400'}`}>
                                    {user.role || 'user'}
                                </span>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-black text-white rounded-2xl flex items-center justify-center text-xl font-black shadow-lg shadow-gray-200">
                                    {user?.name?.charAt(0)?.toUpperCase() || user?.username?.charAt(0)?.toUpperCase() || 'U'}
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-sm font-black text-black leading-tight tracking-tight">{user.name || user.username}</h3>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">@{user.username}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mt-2">
                                <div className="space-y-0.5">
                                    <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest leading-none">Security ID</p>
                                    <p className="text-[10px] font-bold text-black truncate">{user.collegeId || 'N/A'}</p>
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest leading-none">Reputation</p>
                                    <p className="text-[10px] font-bold text-black flex items-center gap-1">⭐ {user.rating || '0.0'}</p>
                                </div>
                                <div className="space-y-0.5 col-span-2">
                                    <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest leading-none">Primary Contact</p>
                                    <p className="text-[10px] font-bold text-black truncate">{user.email}</p>
                                </div>
                                <div className="space-y-0.5 col-span-2">
                                    <p className="text-[8px] font-black text-gray-300 uppercase tracking-widest leading-none">Mobile</p>
                                    <p className="text-[10px] font-bold text-black">{user.phone}</p>
                                </div>
                            </div>

                            <div className="mt-2 pt-4 border-t border-gray-50 flex flex-col gap-3">
                                {/* Role Control */}
                                <div className="flex gap-2">
                                    <select 
                                        value={user.role || 'user'}
                                        onChange={(e) => handleUpdateStatus(user.id, { role: e.target.value })}
                                        className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-2 text-[9px] font-black uppercase tracking-widest focus:ring-1 ring-black transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="user">👤 User</option>
                                        <option value="driver">🏎️ Driver</option>
                                        <option value="admin">🛡️ Admin</option>
                                    </select>

                                    {user.isBanned ? (
                                        <button 
                                            onClick={() => handleUpdateStatus(user.id, { isBanned: false })}
                                            className="flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100 transition-all active:scale-95"
                                        >
                                            ✅ UNBAN
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={async () => {
                                                const res = await fetch(`${API_BASE_URL}/api/admin/ban-user`, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ userId: user.id })
                                                });
                                                const data = await res.json();
                                                if (data.success) {
                                                    fetchUsers();
                                                }
                                            }}
                                            className="flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-all active:scale-95"
                                        >
                                            🚫 BAN
                                        </button>
                                    )}
                                </div>

                                {user.isBanned && (
                                    <div className="animate-in slide-in-from-top-2 duration-300">
                                        <input 
                                            type="text"
                                            placeholder="REASON FOR BAN..."
                                            defaultValue={user.banReason || ""}
                                            onBlur={(e) => handleUpdateStatus(user.id, { banReason: e.target.value })}
                                            className="w-full bg-red-50/30 border border-red-100 rounded-xl px-4 py-2 text-[9px] font-bold text-red-600 uppercase tracking-tight outline-none focus:ring-2 ring-red-100"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="col-span-full py-20 text-center border-2 border-dashed border-gray-100 rounded-[2.5rem]">
                        <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Empty Stakeholder Pool</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminUsersPage;
