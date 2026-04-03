// import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

function AdminHome({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = location.pathname;

  const navItems = [
    { key: '/admin/dashboard', label: 'Dash', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
      </svg>
    )},
    { key: '/admin/users', label: 'Users', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    )},
    { key: '/admin/verifications', label: 'Verify', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    )},
    { key: '/admin/rides', label: 'Live', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )},
    { key: '/admin/reports', label: 'Alerts', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    )}
  ];

  const handleLogout = () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('isAdmin');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Admin Header Area */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-9 h-9 bg-black text-white rounded-2xl flex items-center justify-center font-black shadow-lg shadow-gray-200">A</div>
             <div>
               <h1 className="text-sm font-black tracking-tighter text-black uppercase">Root Control</h1>
               <p className="text-[9px] font-bold text-gray-300 uppercase tracking-[0.2em]">Ridemate Command Centre</p>
             </div>
          </div>
          <button onClick={handleLogout} className="w-10 h-10 flex items-center justify-center text-gray-300 hover:text-black hover:bg-gray-50 rounded-full transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content View */}
      <main className="pt-16 max-w-2xl mx-auto min-h-[calc(100vh-64px)]">
        {children || (
            <div className="flex flex-col items-center justify-center h-[70vh] text-center p-8 space-y-4">
                <div className="w-20 h-20 bg-gray-50 rounded-[2.5rem] flex items-center justify-center text-3xl">📡</div>
                <div className="space-y-1">
                    <h2 className="text-xl font-black uppercase tracking-tight">System Initialization</h2>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest max-w-[200px]">Establishing secure connection to core services...</p>
                </div>
            </div>
        )}
      </main>

      {/* Bottom Minimal Nav */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-gray-100 px-4 pb-4">
        <div className="max-w-md mx-auto grid grid-cols-5 h-16 bg-white rounded-[2rem] shadow-2xl shadow-gray-200 border border-gray-50 px-2">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => navigate(item.key)}
              className="flex flex-col items-center justify-center gap-1 group transition-all relative"
            >
              <div className={`transition-all duration-300 ${activeTab === item.key ? 'text-black scale-110' : 'text-gray-300 group-hover:text-gray-500'}`}>
                {item.icon}
              </div>
              <span className={`text-[9px] font-black uppercase tracking-wider transition-all
                ${activeTab === item.key ? 'text-black' : 'text-gray-300 group-hover:text-gray-400'}`}>
                {item.label}
              </span>
              {activeTab === item.key && (
                <div className="absolute bottom-1 w-6 h-1 bg-black rounded-full animate-in slide-in-from-bottom-1"></div>
              )}
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}

export default AdminHome;
