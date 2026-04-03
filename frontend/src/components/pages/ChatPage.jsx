import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { API_BASE_URL } from '../../config/api';
import LoadingSpinner from '../shared/LoadingSpinner';
import './ChatPage.css';

function ChatPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const receiverId = location.state?.receiverId;
  const receiverName = location.state?.receiverName || 'Unknown';

  const messagesEndRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const markMessagesAsRead = async () => {
    if (!receiverId) return;
    try {
      const userId = localStorage.getItem('userId');
      await fetch(`${API_BASE_URL}/api/messages/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, partnerId: receiverId })
      });
    } catch (err) {
      console.error('Failed to mark messages as read', err);
    }
  };

  useEffect(() => {
    const fetchChatHistory = async () => {
      if (!receiverId) return;
      try {
        const userId = localStorage.getItem('userId');
        const url = `${API_BASE_URL}/api/messages/${userId}`;
        const response = await fetch(url);
        const data = await response.json();

        if (response.ok && data.success) {
          const chatHistory = data.messages
            .filter(msg => {
              const sid = msg.senderId?.toString();
              const rid = msg.receiverId?.toString();
              const target = receiverId?.toString();
              return sid === target || rid === target;
            })
            .map(msg => {
              const userIdStr = localStorage.getItem('userId')?.toString();
              const senderIdStr = msg.senderId?.toString();
              // CRITICAL DEBUG: Ensure alignment comparison is exact
              const isMe = senderIdStr === userIdStr;
              
              return {
                id: msg.id || msg._id,
                sender: isMe ? 'me' : 'other',
                text: msg.message,
                seen: msg.seen || false,
                time: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                rawSender: msg.senderId // For console debugging
              };
            });

          setMessages(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(chatHistory)) {
              console.log("Chat Updated - Messages Count:", chatHistory.length);
              return chatHistory;
            }
            return prev;
          });
          
          const lastMsg = chatHistory[chatHistory.length - 1];
          if (lastMsg && lastMsg.sender === 'other' && !lastMsg.seen) {
            markMessagesAsRead();
          }
        }
      } catch (err) {
        console.error('Failed to fetch chat history', err);
      } finally {
        setLoading(false);
      }
    };

    fetchChatHistory();
    const interval = setInterval(fetchChatHistory, 5000);
    return () => clearInterval(interval);
  }, [receiverId]);

  useEffect(() => {
    if (!loading && messages.length > 0) {
      // Force scroll to bottom whenever messages list or loading state changes
      setTimeout(() => {
        scrollToBottom();
      }, 50);
    }
  }, [messages.length, loading]);

  const handleSend = async () => {
    if (!newMessage.trim() || !receiverId) return;

    const messageText = newMessage.trim();
    const userId = localStorage.getItem('userId');
    const username = localStorage.getItem('username') || 'User';
    
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const tempId = Date.now().toString();

    // OPTIMISTIC UPDATE
    setMessages(prev => [...prev, {
      id: tempId,
      sender: 'me',
      text: messageText,
      seen: false,
      time: timeStr
    }]);
    setNewMessage(''); 

    try {
      const url = `${API_BASE_URL}/api/send-message`;
      const response = await fetch(url, {
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
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      showToast('Connection error', 'error');
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
      const url = `${API_BASE_URL}/api/report-user`;
      const res = await fetch(url, {
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
    <div className="flex flex-col h-screen bg-[#e5ddd5] chat-container relative">
      {/* ── Chat Header ── */}
      <div className="bg-[#ededed] border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-[#54656f] hover:opacity-50 transition-opacity">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="relative">
            <div className="w-10 h-10 bg-[#dfe5e7] text-gray-500 rounded-full flex items-center justify-center text-lg font-bold">
              {receiverName[0]}
            </div>
          </div>
          <div className="overflow-hidden">
            <h2 className="text-[15px] font-bold text-black leading-tight truncate">{receiverName}</h2>
            <p className="text-[12px] text-gray-500 leading-tight">Online</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowReportModal(true)}
            className="text-[#54656f] hover:text-red-500 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Messages Area ── */}
      <div className="flex-1 overflow-y-auto px-4 py-6 scrollbar-whatsapp">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="flex flex-col gap-1 w-full min-h-full">
            {messages.map((msg) => {
              const isMe = msg.sender === 'me';
              return (
                <div 
                  key={msg.id} 
                  className={`w-full flex ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`bubble animate-in duration-300 ${isMe ? 'right' : 'left'}`}>
                    <div className="text-[14.2px] break-words">
                      {msg.text}
                    </div>
                    <div className="bubble-meta">
                      <span className="bubble-time">{msg.time}</span>
                      {isMe && (
                        <div className="bubble-ticks">
                          <svg viewBox="0 0 16 11" width="15" height="10" className={`tick-icon ${msg.seen ? 'seen' : ''}`} fill="currentColor">
                            <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266a.32.32 0 0 0 .484-.032l6.273-7.982a.366.366 0 0 0-.063-.51zm-4.257.006l-.479-.373a.367.367 0 0 0-.512.063L4.409 10.155a.32.32 0 0 1-.484.033l-1.383-1.041a.367.367 0 0 0-.511.063l-.478.372a.418.418 0 0 0-.063.541l2.251 2.97a.32.32 0 0 0 .484-.032l6.54-9.805a.367.367 0 0 0-.063-.51z"></path>
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} className="h-2 w-full" />
          </div>
        )}
      </div>

      {/* ── Message Input ── */}
      <div className="px-4 py-3 bg-[#f0f2f5] flex items-center gap-3 sticky bottom-0">
        <div className="flex-1 flex items-center gap-2">
          <input
            type="text"
            placeholder="Type a message"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            className="flex-1 px-4 py-2.5 bg-white border-transparent rounded-lg text-[15px] focus:outline-none transition-all placeholder:text-gray-400"
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim()}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${newMessage.trim() ? 'bg-[#00a884] text-white' : 'text-[#8696a0]'}`}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" className={!newMessage.trim() ? 'opacity-50' : ''} fill="currentColor">
              <path d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"></path>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Report Modal ── */}
      {showReportModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowReportModal(false)}></div>
          <div className="bg-white w-full max-w-sm rounded-lg p-6 space-y-4 relative overflow-hidden shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-black">Report User</h3>
              <button 
                onClick={() => setShowReportModal(false)}
                className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:text-black transition-colors"
                disabled={reporting}
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[12px] font-bold text-gray-500 uppercase tracking-wider px-1">Reason</label>
                <select 
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold focus:bg-white focus:border-[#00a884] outline-none"
                >
                  <option value="Spam">Spam</option>
                  <option value="Harassment">Harassment</option>
                  <option value="Inappropriate Profile">Inappropriate Profile</option>
                  <option value="Other">Other Issues</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[12px] font-bold text-gray-500 uppercase tracking-wider px-1">Details</label>
                <textarea 
                  rows="3"
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Tell us what happened..."
                  className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:bg-white focus:border-[#00a884] transition-all resize-none"
                ></textarea>
              </div>
            </div>

            <button 
              onClick={handleReport}
              disabled={reporting}
              className="w-full py-3 bg-[#00a884] text-white text-sm font-bold rounded-lg hover:bg-[#008f70] active:scale-95 transition-all disabled:bg-gray-100 disabled:text-gray-400"
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
