import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config/api';

function MessagePage() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const userId = localStorage.getItem('userId');
        const response = await fetch(`${API_BASE_URL}/api/messages/${userId}`);
        const data = await response.json();

        if (response.ok && data.success) {
          const grouped = {};

          data.messages.forEach(msg => {
            const partnerId = msg.senderId === userId ? msg.receiverId : msg.senderId;
            if (partnerId === 'system') return; // Skip system notifications in chat list
            
            // Always overwrite to get the latest message details since the API returns chronological order
            grouped[partnerId] = {
              id: partnerId,
              name: msg.contactName || 'User',
              avatar: (msg.contactName || 'U')[0].toUpperCase(),
              lastMessage: msg.message,
              time: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              rawTime: new Date(msg.timestamp),
              unread: 0
            };
          });

          const convList = Object.values(grouped).sort((a, b) => b.rawTime - a.rawTime);
          setConversations(convList);
        }
      } catch (err) {
        console.error('Failed to fetch messages', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, []);

  const handleChatOpen = (conv) => {
    navigate('/chat', { 
      state: { 
        receiverId: conv.id, 
        receiverName: conv.name 
      } 
    });
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-md mx-auto px-4 pb-20 pt-8">
        {/* ── Header ── */}
        <div className="pb-6 flex items-center justify-between">
          <h1 className="text-3xl font-black tracking-tighter text-black uppercase">Messages</h1>
          <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">{conversations.length} Active</span>
        </div>

        {/* ── Search Bar ── */}
        <div className="pb-6">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search conversations..."
              className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-transparent rounded-2xl text-xs font-bold focus:outline-none focus:bg-white focus:border-black transition-all"
            />
          </div>
        </div>

        {/* ── Conversations List ── */}
        <div className="space-y-1">
          {loading ? (
            <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest text-center py-10">Loading Messages...</p>
          ) : conversations.length > 0 ? (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => handleChatOpen(conv)}
                className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors group"
              >
                <div className="relative shrink-0">
                  <div className={`w-12 h-12 ${conv.unread > 0 ? 'bg-black text-white' : 'bg-gray-50 text-gray-400'} rounded-2xl flex items-center justify-center text-sm font-black group-hover:scale-95 transition-transform`}>
                    {conv.avatar[0]}
                  </div>
                  {conv.unread > 0 && (
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-black text-white rounded-full border-2 border-white flex items-center justify-center text-[9px] font-black animate-bounce shadow-sm">
                      {conv.unread}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 text-left">
                  <div className="flex justify-between items-baseline mb-1">
                    <p className={`text-sm ${conv.unread > 0 ? 'font-black' : 'font-bold'} text-black truncate`}>{conv.name}</p>
                    <p className="text-[9px] font-black text-gray-300 uppercase tracking-tight ml-2 shrink-0">{conv.time}</p>
                  </div>
                  <p className={`text-[11px] ${conv.unread > 0 ? 'font-black text-black' : 'font-bold text-gray-400'} truncate uppercase tracking-tight leading-tight`}>
                    {conv.lastMessage}
                  </p>
                </div>
              </button>
            ))
          ) : (
            <div className="text-center py-20">
              <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">No messages yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MessagePage;
