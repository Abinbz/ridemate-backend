import React, { useState, useEffect } from 'react';
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
            const response = await fetch(`${API_BASE_URL}/api/admin/users`);
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

    const filteredUsers = users.filter(user => 
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
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
                                    {user.name ? user.name[0].upper() : user.username ? user.username[0].upper() : 'U'}
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

                            <div className="mt-2 pt-4 border-t border-gray-50 flex gap-2">
                                <button className="flex-1 py-2.5 rounded-xl border border-black text-[9px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-all">
                                    Edit Roles
                                </button>
                                <button className="flex-1 py-2.5 rounded-xl bg-gray-50 text-[9px] font-black uppercase tracking-widest hover:bg-red-50 hover:text-red-600 transition-all">
                                    Restrict
                                </button>
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
