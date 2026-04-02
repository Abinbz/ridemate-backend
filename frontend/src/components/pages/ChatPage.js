import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { API_BASE_URL } from '../../config/api';
import LoadingSpinner from '../shared/LoadingSpinner';

function ChatPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const receiverId = location.state?.receiverId;
  const receiverName = location.state?.receiverName || 'Unknown';

  useEffect(() => {
    if (receiverId) {
      console.log("Chat opened with:", receiverId);
    }
  }, [receiverId]);

  const messagesEndRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const fetchChatHistory = async () => {
      if (!receiverId) return;
      try {
        const userId = localStorage.getItem('userId');
        const response = await fetch(`${API_BASE_URL}/api/messages/${userId}`);
        const data = await response.json();

        if (response.ok && data.success) {
          // Filter messages belonging to this specific conversation
          const chatHistory = data.messages
            .filter(msg => msg.senderId === receiverId || msg.receiverId === receiverId)
            .map(msg => ({
              id: msg.id || msg._id,
              sender: msg.senderId === userId ? 'me' : 'other',
              text: msg.message,
              time: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }));

          // Only update if data changed to avoid redundant re-renders
          setMessages(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(chatHistory)) {
              return chatHistory;
            }
            return prev;
          });
        }
      } catch (err) {
        console.error('Failed to fetch chat history', err);
      } finally {
        setLoading(false);
      }
    };

    fetchChatHistory();
    // 5s Polling for "real-time" sync
    const interval = setInterval(fetchChatHistory, 5000);
    return () => clearInterval(interval);
  }, [receiverId]);

  useEffect(() => {
    if (!loading) {
      scrollToBottom();
    }
  }, [messages, loading]);

  const handleSend = async () => {
    if (!newMessage.trim() || !receiverId) return;

    const messageText = newMessage.trim();
    const userId = localStorage.getItem('userId');
    const username = localStorage.getItem('username') || 'User';
    
    // PART 5 & 8 — Update UI instantly
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const tempId = Date.now().toString();

    setMessages(prev => [...prev, {
      id: tempId,
      sender: 'me',
      text: messageText,
      time: timeStr
    }]);
    setNewMessage(''); 

    try {
      const response = await fetch(`${API_BASE_URL}/api/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: userId,
          receiverId: receiverId,
          message: messageText,
          senderName: username
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        showToast(data.message || 'Failed to send message', 'error');
        // Optional: remove the optimistic message if it failed
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      showToast('Server not reachable. Check backend connection.', 'error');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('Spam');
  const [reportDetails, setReportDetails] = useState('');
  const [reporting, setReporting] = useState(false);

  const handleReport = async () => {
    try {
      setReporting(true);
      const userId = localStorage.getItem('userId');
      const res = await fetch(`${API_BASE_URL}/api/report-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporterId: userId,
          reportedId: receiverId,
          reason: reportReason,
          details: reportDetails
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('User reported to admin', 'success');
        setShowReportModal(false);
      } else {
        showToast(data.message || 'Report failed', 'error');
      }
    } catch (err) {
      showToast('Connection error', 'error');
    } finally {
      setReporting(false);
    }
  };

  if (!receiverId) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-sm font-black text-black uppercase tracking-widest mb-4">No chat selected</h2>
        <button onClick={() => navigate(-1)} className="text-[10px] font-black text-black border-b border-black pb-0.5 uppercase tracking-widest hover:opacity-50 transition-opacity">Go Back</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white relative">
      {/* ── Chat Header ── */}
      <div className="bg-white border-b border-gray-50 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-black hover:opacity-50 transition-opacity">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="relative">
            <div className="w-11 h-11 bg-black text-white rounded-2xl flex items-center justify-center text-sm font-black">
              {receiverName[0]}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-black border-2 border-white rounded-full"></div>
          </div>
          <div>
            <h2 className="text-sm font-black text-black leading-none mb-1">{receiverName}</h2>
            <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest leading-none">Online</p>
          </div>
        </div>
        <button 
          onClick={() => setShowReportModal(true)}
          className="text-gray-200 hover:text-red-500 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </button>
      </div>

      {/* ── Messages Area ── */}
      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8 scrollbar-hide">
        {loading ? (
          <LoadingSpinner />
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-6 py-4 rounded-[2rem] shadow-sm relative ${msg.sender === 'me'
                      ? 'bg-black text-white rounded-br-none'
                      : 'bg-gray-50 text-black rounded-bl-none border border-gray-100'
                    }`}
                >
                  <p className="text-xs font-bold leading-relaxed">{msg.text}</p>
                  <span className={`text-[8px] font-black uppercase tracking-widest mt-2 block ${msg.sender === 'me' ? 'text-gray-400' : 'text-gray-300'
                    }`}>
                    {msg.time}
                  </span>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>


      {/* ── Message Input ── */}
      <div className="p-6 bg-white border-t border-gray-50 flex items-center gap-4 sticky bottom-0">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            className="w-full pl-6 pr-12 py-4 bg-gray-50 border border-transparent rounded-full text-xs font-bold focus:outline-none focus:bg-white focus:border-black transition-all"
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim()}
            className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-all ${newMessage.trim() ? 'bg-black text-white scale-100' : 'bg-gray-100 text-gray-300 scale-90'
              }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Report Modal ── */}
      {showReportModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowReportModal(false)}></div>
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 space-y-6 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-black uppercase tracking-widest">Report User</h3>
              <button 
                onClick={() => setShowReportModal(false)}
                className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:text-black transition-colors"
                disabled={reporting}
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Reason</label>
                <select 
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full px-4 py-4 bg-gray-50 border border-transparent rounded-2xl text-xs font-black appearance-none cursor-pointer focus:bg-white focus:border-black transition-all"
                >
                  <option value="Spam">Spam</option>
                  <option value="Harassment">Harassment</option>
                  <option value="Inappropriate Profile">Inappropriate Profile</option>
                  <option value="Other">Other Issues</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Details</label>
                <textarea 
                  rows="3"
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Tell us what happened..."
                  className="w-full px-4 py-4 bg-gray-50 border border-transparent rounded-2xl text-xs font-bold focus:outline-none focus:bg-white focus:border-black transition-all resize-none"
                ></textarea>
              </div>
            </div>

            <button 
              onClick={handleReport}
              disabled={reporting}
              className="w-full py-4 bg-black text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-gray-900 active:scale-95 transition-all disabled:bg-gray-100 disabled:text-gray-400"
            >
              {reporting ? 'Submitting...' : 'Send Report'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatPage;
