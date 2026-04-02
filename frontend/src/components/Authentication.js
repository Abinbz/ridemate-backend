import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';
import { useToast } from '../context/ToastContext';

function Authentication() {
  const [authMode, setAuthMode] = useState('userLogin'); // userLogin, userSignup, adminLogin
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    collegeId: '',
    email: '',
    phone: '',
    gender: 'Male',
    password: ''
  });
  const [validationErrors, setValidationErrors] = useState({});
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const validateField = (name, value) => {
    let error = '';
    switch (name) {
      case 'name':
        if (!/^[A-Za-z\s]*$/.test(value)) error = 'Only letters and spaces allowed';
        break;
      case 'username':
        if (/\s/.test(value)) error = 'Username cannot contain spaces';
        // If login mode and it looks like an email, validate email format
        if ((authMode === 'userLogin' || authMode === 'adminLogin') && value.includes('@')) {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) error = 'Invalid email format';
        }
        break;
      case 'phone':
        if (value && !/^\d{0,10}$/.test(value)) error = 'Only digits allowed';
        if (value.length > 0 && value.length !== 10) error = 'Phone must be exactly 10 digits';
        break;
      case 'email':
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) error = 'Invalid email format';
        break;
      case 'password':
        if (value.length > 0) {
          if (value.length < 6) error = 'Minimum 6 characters';
          else if (!/[A-Z]/.test(value)) error = 'At least 1 uppercase letter';
          else if (!/\d/.test(value)) error = 'At least 1 number';
          else if (!/[^A-Za-z0-9]/.test(value)) error = 'At least 1 symbol';
        }
        break;
      default:
        break;
    }
    return error;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    
    const fieldError = validateField(name, value);
    setValidationErrors({ ...validationErrors, [name]: fieldError });
    setError('');
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const apiUrl = authMode === 'userSignup' ? 'signup' : (authMode === 'userLogin' ? 'login' : 'admin-login');
    const isSignup = authMode === 'userSignup';

    if (isSignup) {
      const { name, username, collegeId, email, phone, gender, password } = formData;
      if (!name || !username || !collegeId || !email || !phone || !gender || !password) {
        setError('All fields are required.');
        return;
      }
    } else {
      const { username, password } = formData;
      if (!username || !password) {
        setError('Please enter both username and password.');
        return;
      }
    }

    // Block submit if internal validation errors exist
    const hasErrors = Object.values(validationErrors).some(err => err !== '');
    if (hasErrors) {
      setError('Please fix the errors before submitting.');
      return;
    }

    setLoading(true);
    
    // Cold start notification for Render free tier
    const warmupTimer = setTimeout(() => {
      showToast('Waking up server... please wait (up to 30s)', 'info');
    }, 3000);

    try {
      const response = await fetch(`${API_BASE_URL}/api/${apiUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isSignup ? formData : { username: formData.username, password: formData.password })
      });
      clearTimeout(warmupTimer);
      const data = await response.json();
      if (response.ok && data.success) {
        // Persist user session for API calls
        if (data.userId) {
          localStorage.setItem('userId', data.userId);
          localStorage.setItem('username', formData.username);
        }
        if (authMode === 'adminLogin') {
          localStorage.setItem('isAdmin', 'true');
        } else {
          localStorage.setItem('isAdmin', 'false');
        }
        navigate(authMode === 'adminLogin' ? '/admin/dashboard' : '/user/home');
      } else {
        setError(data.message || 'Authentication failed');
      }
    } catch (err) {
      setError('Server not reachable. Check backend connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 sm:p-12">
      {/* Centered Card */}
      <div className="w-full max-w-sm bg-white border border-gray-200 shadow-sm rounded-3xl p-8 space-y-8">

        {/* Branding */}
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tighter text-black">
            RIDE<span className="text-gray-400 font-medium">MATE</span>
          </h1>
          <p className="mt-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest">Minimal Campus Carpooling</p>
        </div>

        {/* Auth Mode Toggle */}
        <div className="flex border-b border-gray-100 pb-1">
          {['userSignup', 'userLogin', 'adminLogin'].map((mode) => (
            <button
              key={mode}
              onClick={() => { setAuthMode(mode); setError(''); }}
              className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-all duration-200 border-b-2 
                ${authMode === mode
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200'}`}
            >
              {mode === 'userSignup' ? 'Join' : (mode === 'userLogin' ? 'Sign In' : 'Admin')}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-bold flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleAuthSubmit} className="space-y-4">
          {authMode === 'userSignup' && (
            <>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Display Name</label>
                <input name="name" value={formData.name} onChange={handleInputChange}
                  className={`w-full px-4 py-3 bg-gray-50 border rounded-[1.5rem] text-xs font-bold focus:outline-none transition-all 
                    ${validationErrors.name ? 'border-red-500 bg-red-50' : 'border-transparent focus:bg-white focus:border-black'}`}
                  placeholder="e.g. John Doe" />
                {validationErrors.name && <p className="text-[9px] text-red-500 font-bold px-4">{validationErrors.name}</p>}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">College Roll No</label>
                <input name="collegeId" value={formData.collegeId} onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-[1.5rem] text-xs font-bold focus:outline-none focus:bg-white focus:border-black transition-all"
                  placeholder="KMCT-1234" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Email</label>
                  <input name="email" type="email" value={formData.email} onChange={handleInputChange}
                    className={`w-full px-4 py-3 bg-gray-50 border rounded-[1.5rem] text-xs font-bold focus:outline-none transition-all 
                      ${validationErrors.email ? 'border-red-500 bg-red-50' : 'border-transparent focus:bg-white focus:border-black'}`}
                    placeholder="john@example.com" />
                  {validationErrors.email && <p className="text-[9px] text-red-500 font-bold px-1">{validationErrors.email}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Phone</label>
                  <input name="phone" value={formData.phone} onChange={handleInputChange}
                    className={`w-full px-4 py-3 bg-gray-50 border rounded-[1.5rem] text-xs font-bold focus:outline-none transition-all 
                      ${validationErrors.phone ? 'border-red-500 bg-red-50' : 'border-transparent focus:bg-white focus:border-black'}`}
                    placeholder="10 digit number" />
                  {validationErrors.phone && <p className="text-[9px] text-red-500 font-bold px-1">{validationErrors.phone}</p>}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Gender</label>
                <select name="gender" value={formData.gender} onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-[1.5rem] text-xs font-bold focus:outline-none focus:bg-white focus:border-black transition-all appearance-none cursor-pointer">
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">
              {authMode === 'adminLogin' ? 'Admin ID' : 'Username'}
            </label>
            <input name="username" value={formData.username} onChange={handleInputChange}
              className={`w-full px-4 py-3 bg-gray-50 border rounded-[1.5rem] text-xs font-bold focus:outline-none transition-all 
                ${validationErrors.username ? 'border-red-500 bg-red-50' : 'border-transparent focus:bg-white focus:border-black'}`}
              placeholder={authMode === 'adminLogin' ? 'admin_root' : 'Username'} />
            {validationErrors.username && <p className="text-[9px] text-red-500 font-bold px-4">{validationErrors.username}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Passphrase</label>
            <input name="password" type="password" value={formData.password} onChange={handleInputChange}
              className={`w-full px-4 py-3 bg-gray-50 border rounded-[1.5rem] text-xs font-bold focus:outline-none transition-all 
                ${validationErrors.password ? 'border-red-500 bg-red-50' : 'border-transparent focus:bg-white focus:border-black'}`}
              placeholder="••••••••" />
            {validationErrors.password && <p className="text-[9px] text-red-500 font-bold px-4">{validationErrors.password}</p>}
          </div>

          <button type="submit" 
            disabled={loading || Object.values(validationErrors).some(err => err !== '')}
            className="w-full py-4 mt-8 bg-black text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-[1.5rem] hover:bg-gray-900 active:scale-[0.98] transition-all disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed">
            {loading ? 'Processing...' : (authMode === 'userSignup' ? 'Create Account' : 'Authenticate')}
          </button>
        </form>

      </div>

      <p className="text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-8">
        By continuing, you agree to Ridemate's terms.
      </p>
    </div>
  );
}

export default Authentication;
