import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import LoadingSpinner from '../shared/LoadingSpinner';
import { API_BASE_URL } from '../../config/api';

function ProfilePage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [licenseOpen, setLicenseOpen] = useState(false);
  const [vehicleOpen, setVehicleOpen] = useState(false);

  const [licenseData, setLicenseData] = useState({
    licenseNumber: '',
    licenseFile: null,
    licenseFileName: ''
  });

  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState([]);
  const [currentVehicle, setCurrentVehicle] = useState({
    vehicleName: '',
    rcFile: null,
    rcFileName: '',
    insuranceFile: null,
    insuranceFileName: ''
  });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userId = localStorage.getItem('userId');
        if (!userId) {
          navigate('/');
          return;
        }
        const response = await fetch(`${API_BASE_URL}/api/user/${userId}`);
        const data = await response.json();
        if (response.ok && data.success) {
          setUserData(data.user);
        }
      } catch (err) {
        console.error('Failed to fetch user profile:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [navigate]);

  const handleEditProfile = () => navigate('/user/edit-profile');
  const handleRatings = () => navigate('/user/ratings');

  const handleLicenseChange = (e) => {
    const { name, value } = e.target;
    setLicenseData({ ...licenseData, [name]: value });
  };

  const handleLicenseFileChange = (e) => {
    const file = e.target.files[0];
    if (file) setLicenseData({ ...licenseData, licenseFile: file, licenseFileName: file.name });
  };

  const handleLicenseSubmit = () => {
    if (!licenseData.licenseNumber) {
      showToast('Please enter your license number.', 'error');
      return;
    }
    showToast('License details cached. Click Submit below to verify.', 'success');
  };

  const handleVehicleChange = (e) => {
    const { name, value } = e.target;
    setCurrentVehicle({ ...currentVehicle, [name]: value });
  };

  const handleVehicleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      if (type === 'rc') {
        setCurrentVehicle({ ...currentVehicle, rcFile: file, rcFileName: file.name });
      } else {
        setCurrentVehicle({ ...currentVehicle, insuranceFile: file, insuranceFileName: file.name });
      }
    }
  };

  const handleAddVehicle = () => {
    if (!currentVehicle.vehicleName) {
      showToast('Please enter the vehicle name.', 'error');
      return;
    }
    const newVehicle = { ...currentVehicle, id: Date.now() };
    setVehicles([...vehicles, newVehicle]);
    setCurrentVehicle({ vehicleName: '', rcFile: null, rcFileName: '', insuranceFile: null, insuranceFileName: '' });
    showToast(`Vehicle "${newVehicle.vehicleName}" added to queue.`, 'success');
  };

  const handleRemoveVehicle = (id) => setVehicles(vehicles.filter(v => v.id !== id));

  const [isSubmittingKYC, setIsSubmittingKYC] = useState(false);
  const handleKYCSubmit = async () => {
    if (!licenseData.licenseNumber || !licenseData.licenseFile) {
        showToast('Please upload your license document.', 'error');
        return;
    }
    if (vehicles.length === 0) {
        showToast('Please add at least one vehicle with RC and Insurance.', 'error');
        return;
    }

    setIsSubmittingKYC(true);
    try {
        const userId = localStorage.getItem('userId');
        const formData = new FormData();
        formData.append('userId', userId);
        formData.append('license', licenseData.licenseFile);
        formData.append('rc', vehicles[0].rcFile);
        formData.append('insurance', vehicles[0].insuranceFile);
        formData.append('licenseNumber', licenseData.licenseNumber);
        formData.append('vehicleName', vehicles[0].vehicleName);

        const response = await fetch(`${API_BASE_URL}/api/user/upload-docs`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        if (data.success) {
            showToast('Documents uploaded to cloud for verification!', 'success');
            setUserData({ ...userData, isVerified: false });
        } else {
            showToast(data.message || 'Submission failed.', 'error');
        }
    } catch (error) {
        showToast('Server error during KYC submission.', 'error');
    } finally {
        setIsSubmittingKYC(false);
    }
  };

  if (loading || !userData) {
    return <div className="min-h-screen bg-white"><LoadingSpinner /></div>;
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Profile Header */}
      <div className="px-6 py-12 border-b border-gray-50 flex flex-col items-center text-center">
        <div onClick={handleEditProfile} className="relative group cursor-pointer">
          <div className="w-24 h-24 bg-black text-white rounded-[2rem] flex items-center justify-center text-3xl font-black mb-6 group-hover:scale-95 transition-transform uppercase">
            {userData.username?.[0] || 'U'}
          </div>
          <div className="absolute -bottom-1 -right-1 bg-white border-2 border-black p-1.5 rounded-full shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </div>
        </div>
        <h1 className="text-2xl font-black text-black leading-none mb-2">{userData.username}</h1>
        <div className="flex items-center gap-2 mb-2">
            <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest leading-none">ID: {userData.collegeId}</p>
            {userData.isVerified ? (
                <span className="bg-emerald-50 text-emerald-500 text-[8px] font-black uppercase px-2 py-0.5 rounded-full">Verified</span>
            ) : (
                <span className="bg-amber-50 text-amber-500 text-[8px] font-black uppercase px-2 py-0.5 rounded-full">KYC Pending</span>
            )}
        </div>

        <div className="inline-flex items-center gap-2 mt-6 px-4 py-1.5 bg-gray-50 rounded-full cursor-pointer hover:bg-gray-100 transition-colors" onClick={handleRatings}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 .587l3.668 7.568 8.332 1.151-6.064 5.828 1.48 8.279-7.416-3.967-7.417 3.967 1.481-8.279-6.064-5.828 8.332-1.151z" />
          </svg>
          <span className="text-[10px] font-black text-black">
            {userData.rating ? userData.rating.toFixed(1) : 'New'} Rating
            {userData.totalRatings > 0 && (
              <span className="text-gray-300 font-bold ml-1 text-[9px]">({userData.totalRatings} Reviews)</span>
            )}
          </span>
        </div>
      </div>

      {/* Menu Section */}
      <div className="px-6 py-12 max-w-xl mx-auto space-y-4">
        <div className="border border-gray-100 rounded-[2.5rem] overflow-hidden">
          {[
            { title: 'Ride History', sub: 'Past journeys', icon: '◷', action: () => navigate('/user/ride-history') },
            { title: 'Ratings & Reviews', sub: 'View history', icon: '★', action: handleRatings },
            { title: 'Security', sub: 'Manage account', icon: '◈' },
            { title: 'Help & Support', sub: 'Get assistance', icon: '?' }
          ].map((item, i) => (
            <button key={i} onClick={item.action} className={`w-full flex items-center justify-between p-7 hover:bg-gray-50 transition-colors ${i !== 3 ? 'border-b border-gray-50' : ''}`}>
              <div className="flex items-center gap-6">
                <span className="w-10 h-10 bg-gray-50 flex items-center justify-center text-sm font-black rounded-2xl">{item.icon}</span>
                <div className="text-left">
                  <p className="text-xs font-black text-black leading-none mb-1">{item.title}</p>
                  <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">{item.sub}</p>
                </div>
              </div>
              <span className="text-gray-200">&rarr;</span>
            </button>
          ))}
        </div>

        {/* License Section */}
        <div className="border border-gray-100 rounded-[2.5rem] overflow-hidden">
          <button onClick={() => setLicenseOpen(!licenseOpen)} className="w-full flex items-center justify-between p-7 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-6">
              <span className="w-10 h-10 bg-gray-50 flex items-center justify-center text-sm font-black rounded-2xl">L</span>
              <div className="text-left">
                <p className="text-xs font-black text-black leading-none mb-1">Driving License</p>
                <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">{licenseData.licenseNumber ? 'Draft Saved' : 'Action Required'}</p>
              </div>
            </div>
            <span className={`text-gray-300 transition-transform ${licenseOpen ? 'rotate-90' : ''}`}>&rarr;</span>
          </button>
          {licenseOpen && (
            <div className="px-7 pb-8 space-y-4 animate-in fade-in duration-300">
              <input type="text" name="licenseNumber" placeholder="License Number" value={licenseData.licenseNumber} onChange={handleLicenseChange} className="w-full px-5 py-4 bg-gray-50 border border-transparent rounded-2xl text-xs font-bold focus:outline-none focus:bg-white focus:border-black transition-all" />
              <div className="flex items-center gap-4">
                <label className="flex-1 px-5 py-4 bg-gray-50 border border-dashed border-gray-200 rounded-2xl text-center cursor-pointer hover:border-black transition-colors">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{licenseData.licenseFileName || 'Upload Image'}</span>
                  <input type="file" hidden onChange={handleLicenseFileChange} />
                </label>
                <button onClick={handleLicenseSubmit} className="bg-black text-white px-8 py-4 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-gray-900 active:scale-[0.98] transition-all">Cache</button>
              </div>
            </div>
          )}
        </div>

        {/* Vehicle Section */}
        <div className="border border-gray-100 rounded-[2.5rem] overflow-hidden">
          <button onClick={() => setVehicleOpen(!vehicleOpen)} className="w-full flex items-center justify-between p-7 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-6">
              <span className="w-10 h-10 bg-gray-50 flex items-center justify-center text-sm font-black rounded-2xl">V</span>
              <div className="text-left">
                <p className="text-xs font-black text-black leading-none mb-1">Add Vehicles</p>
                <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">{vehicles.length} In Queue</p>
              </div>
            </div>
            <span className={`text-gray-300 transition-transform ${vehicleOpen ? 'rotate-90' : ''}`}>&rarr;</span>
          </button>
          {vehicleOpen && (
            <div className="px-7 pb-8 space-y-6 animate-in fade-in duration-300">
              {vehicles.map((v) => (
                <div key={v.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                  <div>
                    <p className="text-xs font-black text-black">{v.vehicleName}</p>
                    <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Awaiting Verification</p>
                  </div>
                  <button onClick={() => handleRemoveVehicle(v.id)} className="text-gray-200 hover:text-black transition-colors">✕</button>
                </div>
              ))}
              <div className="space-y-3 pt-4 border-t border-gray-50">
                <input name="vehicleName" placeholder="Vehicle Name" value={currentVehicle.vehicleName} onChange={handleVehicleChange} className="w-full px-5 py-4 bg-gray-50 border border-transparent rounded-2xl text-xs font-bold focus:outline-none focus:bg-white focus:border-black transition-all" />
                <div className="grid grid-cols-2 gap-3">
                  <label className="px-4 py-4 bg-white border border-dashed border-gray-200 rounded-2xl text-center cursor-pointer hover:border-black transition-colors">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-tight block">Upload RC</span>
                    <input type="file" hidden onChange={(e) => handleVehicleFileChange(e, 'rc')} />
                  </label>
                  <label className="px-4 py-4 bg-white border border-dashed border-gray-200 rounded-2xl text-center cursor-pointer hover:border-black transition-colors">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-tight block">Insurance</span>
                    <input type="file" hidden onChange={(e) => handleVehicleFileChange(e, 'insurance')} />
                  </label>
                </div>
                <button onClick={handleAddVehicle} className="w-full bg-black text-white py-4 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-gray-900 active:scale-[0.98] transition-all">Add to Queue</button>
              </div>
            </div>
          )}
        </div>

        {/* Global Submit KYC Button */}
        {/* KYC Verification Link */}
        {!userData.isVerified && (
            <button
                onClick={() => navigate('/user/verify')}
                className="w-full py-6 bg-black text-white rounded-[2.5rem] text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-gray-100 hover:scale-[1.02] active:scale-95 transition-all text-center"
            >
                Verify Documents & Identity
            </button>
        )}

        {/* Reports Navigation */}
        <button onClick={() => navigate('/user/reports')} className="w-full flex items-center justify-between p-7 border border-gray-100 rounded-[2.5rem] hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-6">
            <span className="w-10 h-10 bg-gray-50 flex items-center justify-center text-sm font-black rounded-2xl text-red-400">!</span>
            <div className="text-left">
              <p className="text-xs font-black text-black leading-none mb-1">Reports</p>
              <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">System notices</p>
            </div>
          </div>
          <span className="text-gray-200">&rarr;</span>
        </button>

        {/* Logout */}
        <button onClick={() => { localStorage.clear(); navigate('/'); }} className="w-full py-6 mt-8 border border-black rounded-[2.5rem] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-black hover:text-white transition-all text-black">Logout</button>
      </div>
    </div>
  );
}

export default ProfilePage;
