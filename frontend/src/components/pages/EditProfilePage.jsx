import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config/api';
import { useToast } from '../../context/ToastContext';

function EditProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState({
    username: '',
    phone: '',
    email: '',
    collegeId: '',
    gender: 'Male'
  });
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userId = localStorage.getItem('userId');
        const url = `${API_BASE_URL}/api/user/${userId}`;
        console.log("API CALL:", url, 'GET');
        const response = await fetch(url);
        const data = await response.json();
        if (response.ok && data.success) {
          setProfile({
            username: data.user.username || '',
            phone: data.user.phone || '',
            email: data.user.email || '',
            collegeId: data.user.collegeId || '',
            gender: data.user.gender || 'Male'
          });
        }
      } catch (err) {
        console.error('Failed to fetch user profile:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile({ ...profile, [name]: value });
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const userId = localStorage.getItem('userId');
      const url = `${API_BASE_URL}/api/user/update`;
      console.log("API CALL:", url, 'POST');
      const response = await fetch(`${API_BASE_URL}/api/user/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...profile })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        localStorage.setItem('username', profile.username); // Update local cache
        showToast('Profile updated successfully!', 'success');
        setTimeout(() => navigate(-1), 1500);
      } else {
        showToast(data.message || 'Failed to update profile', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast(`Server error: ${err.message || 'Check connection'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-[10px] font-black text-black uppercase tracking-[0.2em]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-50 px-6 py-6 flex items-center gap-4 sticky top-0 z-50">
        <button onClick={() => navigate(-1)} className="text-black hover:opacity-50 transition-opacity">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-sm font-black text-black uppercase tracking-widest">Edit Profile</h1>
      </div>

      <div className="max-w-xl mx-auto px-6 py-12 space-y-10">

        {/* Form Fields */}
        <div className="space-y-6">
          {[
            { label: 'Username', name: 'username', type: 'text' },
            { label: 'Phone Number', name: 'phone', type: 'tel' },
            { label: 'Email Address', name: 'email', type: 'email' },
            { label: 'College ID', name: 'collegeId', type: 'text' },
          ].map((field) => (
            <div key={field.name} className="space-y-2">
              <label className="text-[10px] font-black text-black uppercase tracking-[0.2em] ml-2 leading-none">
                {field.label}
              </label>
              <input
                type={field.type}
                name={field.name}
                value={profile[field.name]}
                onChange={handleChange}
                className="w-full px-6 py-4 bg-gray-50 border border-transparent rounded-[1.5rem] text-xs font-bold focus:outline-none focus:bg-white focus:border-black transition-all"
              />
            </div>
          ))}

          <div className="space-y-2">
            <label className="text-[10px] font-black text-black uppercase tracking-[0.2em] ml-2 leading-none">
              Gender
            </label>
            <select
              name="gender"
              value={profile.gender}
              onChange={handleChange}
              className="w-full px-6 py-4 bg-gray-50 border border-transparent rounded-[1.5rem] text-xs font-black focus:outline-none focus:bg-white focus:border-black transition-all appearance-none cursor-pointer"
            >
              <option value="Male">MALE</option>
              <option value="Female">FEMALE</option>
              <option value="Other">OTHER</option>
            </select>
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full bg-black text-white py-6 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-gray-900 active:scale-[0.98] transition-all shadow-sm disabled:bg-gray-100 disabled:text-gray-400"
        >
          {loading ? 'Finalizing Sync...' : 'Save Changes'}
        </button>

      </div>
    </div>
  );
}

export default EditProfilePage;
