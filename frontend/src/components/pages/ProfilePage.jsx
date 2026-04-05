import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import LoadingSpinner from '../shared/LoadingSpinner';
import { API_BASE_URL } from '../../config/api';
import { uploadToCloudinary } from '../../utils/cloudinary';

function ProfilePage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Vehicle Management State
  const [vehicleTab, setVehicleTab] = useState('list'); // 'list' or 'add'
  const [vehicleList, setVehicleList] = useState([]);
  const [newVehicle, setNewVehicle] = useState({ name: '', number: '' });
  const [isAddingVehicle, setIsAddingVehicle] = useState(false);

  // Document Upload State
  const [licenseNumber, setLicenseNumber] = useState('');
  const [docUrls, setDocUrls] = useState({ license: null, rc: null, insurance: null });
  const [uploadStatus, setUploadStatus] = useState({ license: 'idle', rc: 'idle', insurance: 'idle' });
  const [isSubmittingKYC, setIsSubmittingKYC] = useState(false);

  useEffect(() => {
    fetchProfile();
    fetchVehicles();
  }, []);

  const fetchProfile = async () => {
    try {
      const userId = localStorage.getItem('userId');
      if (!userId) {
        navigate('/');
        return;
      }
      const response = await fetch(`${API_BASE_URL}/api/user/${userId}`);
      const data = await response.json();
      if (data.success) {
        setUserData(data.user);
        // Sync localStorage
        if (data.user.role) localStorage.setItem('role', data.user.role);
        if (data.user.isDriver !== undefined) localStorage.setItem('isDriver', data.user.isDriver ? 'true' : 'false');
        
        // Pre-fill if exists
        if (data.user.documents?.license?.number) {
          setLicenseNumber(data.user.documents.license.number);
        }
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVehicles = async () => {
    try {
      const userId = localStorage.getItem('userId');
      const response = await fetch(`${API_BASE_URL}/api/user/vehicles/${userId}`);
      const data = await response.json();
      if (data.success) {
        setVehicleList(data.vehicles || []);
      }
    } catch (err) {
      console.error('Failed to fetch vehicles:', err);
    }
  };

  const handleAddVehicle = async (e) => {
    e.preventDefault();
    if (!newVehicle.name || !newVehicle.number) {
      showToast('Please fill all vehicle fields.', 'error');
      return;
    }

    setIsAddingVehicle(true);
    try {
      const userId = localStorage.getItem('userId');
      const response = await fetch(`${API_BASE_URL}/api/user/add-vehicle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          name: newVehicle.name,
          number: newVehicle.number
        })
      });
      const data = await response.json();
      if (data.success) {
        showToast('Vehicle added successfully!', 'success');
        setNewVehicle({ name: '', number: '' });
        setVehicleTab('list');
        fetchVehicles();
      }
    } catch (err) {
      showToast('Failed to add vehicle.', 'error');
    } finally {
      setIsAddingVehicle(false);
    }
  };

  const handleFileUpload = async (file, type) => {
    if (!file) return;

    setUploadStatus(prev => ({ ...prev, [type]: 'uploading' }));
    try {
      const url = await uploadToCloudinary(file);
      
      // Part 6: Confirm Cloudinary upload returns valid URL
      if (url && typeof url === 'string') {
        // Part 1: Confirm functional state update for DocUrls
        // Part 5: Prevent state overwrite bug (using functional merge)
        setDocUrls(prev => ({ 
          ...prev, 
          [type]: url 
        }));
        
        // Part 2: Mark as 'done' only after successful sync
        setUploadStatus(prev => ({ ...prev, [type]: 'done' }));
        showToast(`${type.toUpperCase()} uploaded successfully.`, 'success');
      } else {
        throw new Error(`Invalid URL returned for ${type}`);
      }
    } catch (err) {
      setUploadStatus(prev => ({ ...prev, [type]: 'idle' }));
      showToast(`Failed to upload ${type}.`, 'error');
    }
  };

  const handleKYCSubmit = async () => {
    // Part 3: Add debug logging
    console.log("Current docUrls:", docUrls);

    // Part 4: Fix validation logic to allow partial submissions (at least one document)
    if (!docUrls?.license && !docUrls?.rc && !docUrls?.insurance) {
      showToast('Upload at least one document to proceed', 'error');
      return;
    }
    
    // User requested fix: License Number only required if License is uploaded
    if (docUrls.license && !licenseNumber) {
      showToast('Please enter your license number.', 'error');
      return;
    }

    setIsSubmittingKYC(true);
    try {
      const userId = localStorage.getItem('userId');

      const docTypes = ['license', 'rc', 'insurance'];
      for (const type of docTypes) {
        // Part 8: Only process documents that have been successfully uploaded
        if (docUrls[type]) {
          const payload = {
            userId,
            type,
            fileUrl: docUrls[type],
            ...(type === 'license' && { licenseNumber })
          };

          await fetch(`${API_BASE_URL}/api/upload-documents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        }
      }

      showToast('Verification submitted successfully!', 'success');
      fetchProfile(); // Refresh verification status
    } catch (err) {
      showToast('Failed to submit verification.', 'error');
    } finally {
      setIsSubmittingKYC(false);
    }
  };

  if (loading || !userData) {
    return <div className="min-h-screen bg-white"><LoadingSpinner /></div>;
  }

  // Phase 3: Driver Eligibility Logic
  const canBecomeDriver = 
    userData.documents?.license?.status === 'approved' &&
    userData.documents?.rc?.status === 'approved' &&
    userData.documents?.insurance?.status === 'approved';

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Profile Header */}
      <div className="px-6 py-12 border-b border-gray-50 flex flex-col items-center text-center">
        <div className="w-24 h-24 bg-black text-white rounded-[2rem] flex items-center justify-center text-3xl font-black mb-6 uppercase">
          {userData.username?.[0] || 'U'}
        </div>
        <h1 className="text-2xl font-black text-black leading-none mb-2">{userData.username}</h1>
        <div className="flex items-center gap-2 mb-6">
          <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">ID: {userData.collegeId}</p>
          {userData.isVerified ? (
            <span className="bg-emerald-50 text-emerald-500 text-[8px] font-black uppercase px-2 py-0.5 rounded-full">Verified Profile</span>
          ) : (
            <span className="bg-amber-50 text-amber-500 text-[8px] font-black uppercase px-2 py-0.5 rounded-full">KYC Pending</span>
          )}
          {userData.isBanned && (
             <span className="bg-red-50 text-red-500 text-[8px] font-black uppercase px-2 py-0.5 rounded-full">Account Suspended</span>
          )}
        </div>

        {/* --- Reputation Stats Grid --- */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-lg mt-4">
          <div className="bg-gray-50/50 p-4 rounded-3xl border border-gray-100 flex flex-col items-center justify-center">
            <span className="text-xl font-black text-black mb-1 italic">⭐ {userData.avgRating || '5.0'}</span>
            <p className="text-[7px] font-black text-gray-400 uppercase tracking-tighter">Avg Rating</p>
          </div>
          <div className="bg-gray-50/50 p-4 rounded-3xl border border-gray-100 flex flex-col items-center justify-center">
            <span className="text-xl font-black text-black mb-1 italic">{userData.reviewsReceived?.length || 0}</span>
            <p className="text-[7px] font-black text-gray-400 uppercase tracking-tighter">Feedback</p>
          </div>
          <div className="bg-gray-50/50 p-4 rounded-3xl border border-gray-100 flex flex-col items-center justify-center">
            <span className="text-xl font-black text-black mb-1 italic">{userData.reviewsGiven?.length || 0}</span>
            <p className="text-[7px] font-black text-gray-400 uppercase tracking-tighter">Reviews Given</p>
          </div>
          <div className="bg-gray-50/50 p-4 rounded-3xl border border-gray-100 flex flex-col items-center justify-center">
            <span className="text-xl font-black text-red-500 mb-1 italic">{userData.reportsReceived?.length || 0}</span>
            <p className="text-[7px] font-black text-gray-400 uppercase tracking-tighter">Safety Alerts</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-8 max-w-xl mx-auto space-y-10">

        {/* Core Menu */}
        <section className="space-y-4">
          <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] px-1">Navigation Hub</h3>
          <div className="border border-gray-100 rounded-[2.5rem] overflow-hidden">
            {[
              { title: 'Ride History', sub: 'Past journeys', icon: '◷', action: () => navigate('/user/ride-history') },
              { title: 'Ratings & Reviews', sub: 'View feedback', icon: '★', action: () => navigate('/user/ratings') }
            ].map((item, i) => (
              <button key={i} onClick={item.action} className={`w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors ${i === 0 ? 'border-b border-gray-50' : ''}`}>
                <div className="flex items-center gap-5">
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
        </section>

        {/* Vehicle Management */}
        <section className="space-y-4">
          <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em] px-1">My Vehicles</h3>
          <div className="bg-gray-50/50 p-2 rounded-[2rem] flex gap-2 mb-4">
            <button
              onClick={() => setVehicleTab('list')}
              className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest rounded-2xl transition-all ${vehicleTab === 'list' ? 'bg-black text-white shadow-lg' : 'text-gray-400 hover:text-black'}`}
            >
              Collection
            </button>
            <button
              onClick={() => setVehicleTab('add')}
              className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest rounded-2xl transition-all ${vehicleTab === 'add' ? 'bg-black text-white shadow-lg' : 'text-gray-400 hover:text-black'}`}
            >
              Deploy New
            </button>
          </div>

          {vehicleTab === 'list' ? (
            <div className="space-y-3">
              {vehicleList.length > 0 ? vehicleList.map((v, i) => (
                <div key={i} className="bg-white border border-gray-100 p-5 rounded-[2rem] flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black text-black leading-none mb-1">{v.name}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{v.number}</p>
                  </div>
                  <div className="w-8 h-8 bg-gray-50 rounded-xl flex items-center justify-center text-[10px] font-bold">V</div>
                </div>
              )) : (
                <div className="py-12 text-center bg-gray-50/30 rounded-[2.5rem] border border-dashed border-gray-100">
                  <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">No vehicles added</p>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleAddVehicle} className="space-y-3 p-1">
              <input
                type="text"
                placeholder="Vehicle Name (e.g. Swift)"
                value={newVehicle.name}
                onChange={e => setNewVehicle({ ...newVehicle, name: e.target.value })}
                className="w-full px-6 py-5 bg-gray-50 border border-transparent rounded-[2rem] text-xs font-bold focus:outline-none focus:bg-white focus:border-black transition-all"
              />
              <input
                type="text"
                placeholder="Vehicle Number (e.g. KL11AB1234)"
                value={newVehicle.number}
                onChange={e => setNewVehicle({ ...newVehicle, number: e.target.value })}
                className="w-full px-6 py-5 bg-gray-50 border border-transparent rounded-[2rem] text-xs font-bold focus:outline-none focus:bg-white focus:border-black transition-all"
              />
              <button
                type="submit"
                disabled={isAddingVehicle}
                className="w-full py-5 bg-black text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-[2rem] shadow-xl shadow-gray-200 active:scale-[0.98] transition-all disabled:bg-gray-400"
              >
                {isAddingVehicle ? 'Registering...' : 'Submit Vehicle'}
              </button>
            </form>
          )}
        </section>
        <hr className="border-gray-50 my-6" />

        {/* My Documents Display Section */}
        <section className="space-y-6">
          <div className="flex items-end justify-between px-1">
            <div className="flex flex-col gap-1">
              <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Validated Assets</h3>
              <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">My Documents Terminal</p>
            </div>
            {canBecomeDriver && (
              <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 animate-bounce">
                <span className="text-[10px]">🎖️</span>
                <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Driver Grade Active</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { id: 'license', label: 'Driving License', icon: '🪪' },
              { id: 'rc', label: 'Vehicle RC', icon: '📄' },
              { id: 'insurance', label: 'Insurance Policy', icon: '🛡️' }
            ]
            .filter(doc => userData.documents?.[doc.id]?.url) // Hide empty documents
            .map((doc) => {
              const savedDoc = userData.documents?.[doc.id];
              return (
                <div key={doc.id} className="bg-white border rounded-[2.5rem] p-6 flex flex-col gap-5 shadow-sm hover:shadow-xl transition-all duration-500 group/card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-50 rounded-2xl flex items-center justify-center text-lg group-hover/card:scale-110 transition-transform">
                        {doc.icon}
                      </div>
                      <p className="text-[10px] font-black text-black uppercase tracking-widest">{doc.label}</p>
                    </div>
                    <span className={`text-[8px] font-black uppercase px-4 py-2 rounded-full border flex items-center gap-2 ${
                      savedDoc.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      savedDoc.status === 'rejected' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                    }`}>
                      {savedDoc.status === 'approved' ? '✔ Verified' : 
                       savedDoc.status === 'rejected' ? '❌ Rejected' : '⏳ Pending'}
                    </span>
                  </div>

                  <div className="relative group aspect-video rounded-[2rem] overflow-hidden bg-gray-50 border border-gray-50">
                    <img src={savedDoc.url} alt={doc.label} className="w-full h-full object-cover grayscale-[0.5] group-hover:grayscale-0 transition-all duration-700" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center backdrop-blur-[2px]">
                      <button 
                        onClick={() => window.open(savedDoc.url, '_blank')}
                        className="bg-white text-black px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transform translate-y-4 group-hover:translate-y-0 transition-transform shadow-2xl"
                      >
                        Inspect Asset
                      </button>
                    </div>
                  </div>

                  {(doc.id === 'license' && savedDoc?.number) && (
                    <div className="bg-gray-50 px-4 py-3 rounded-2xl">
                      <p className="text-[7px] font-bold text-gray-400 uppercase tracking-widest mb-1">LICENSE ID</p>
                      <p className="text-[10px] font-black text-black uppercase tracking-tight">{savedDoc.number}</p>
                    </div>
                  )}

                  {savedDoc.status === 'rejected' && savedDoc.reason && (
                    <div className="bg-red-50/50 p-4 rounded-2xl border border-red-100 animate-in slide-in-from-top-2 duration-300">
                      <p className="text-[9px] font-bold text-red-600 uppercase tracking-tight leading-relaxed">
                        Moderator Note: {savedDoc.reason}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
        <hr className="border-gray-50 my-6" />

        {/* Structured Document Upload */}
        <section className="space-y-6">
          <div className="flex flex-col gap-1 px-1">
            <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Upload Documents</h3>
            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">KYC Intel Terminal</p>
          </div>

          <div className="space-y-8">
            {/* License Section */}
            <div className="space-y-4">
              <label className="block text-[10px] font-black text-black uppercase tracking-widest px-1">1. Driving License</label>
              <input
                type="text"
                placeholder="License ID Number"
                value={licenseNumber}
                onChange={e => setLicenseNumber(e.target.value)}
                className="w-full px-6 py-4 bg-gray-50 border border-transparent rounded-2xl text-xs font-bold focus:outline-none focus:bg-white focus:border-black transition-all"
              />
              <label className="flex items-center justify-between p-6 bg-white border border-gray-100 rounded-[2rem] cursor-pointer hover:border-black transition-all group">
                <div className="flex items-center gap-4">
                  <span className="text-lg">🪪</span>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest group-hover:text-black transition-colors">
                    {uploadStatus.license === 'done' ? '✔ Done' : uploadStatus.license === 'uploading' ? '⏳ Uploading' : 'Deploy License Image'}
                  </p>
                </div>
                <input type="file" hidden onChange={e => handleFileUpload(e.target.files[0], 'license')} />
                <div className="w-8 h-8 bg-gray-50 rounded-xl flex items-center justify-center text-gray-300 group-hover:bg-black group-hover:text-white transition-all text-xs">&uarr;</div>
              </label>
            </div>

            {/* RC Section */}
            <div className="space-y-4">
              <label className="block text-[10px] font-black text-black uppercase tracking-widest px-1">2. Vehicle RC</label>
              <label className="flex items-center justify-between p-6 bg-white border border-gray-100 rounded-[2rem] cursor-pointer hover:border-black transition-all group">
                <div className="flex items-center gap-4">
                  <span className="text-lg">📄</span>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest group-hover:text-black transition-colors">
                    {uploadStatus.rc === 'done' ? '✔ Done' : uploadStatus.rc === 'uploading' ? '⏳ Uploading' : 'Deploy RC Document'}
                  </p>
                </div>
                <input type="file" hidden onChange={e => handleFileUpload(e.target.files[0], 'rc')} />
                <div className="w-8 h-8 bg-gray-50 rounded-xl flex items-center justify-center text-gray-300 group-hover:bg-black group-hover:text-white transition-all text-xs">&uarr;</div>
              </label>
            </div>

            {/* Insurance Section */}
            <div className="space-y-4">
              <label className="block text-[10px] font-black text-black uppercase tracking-widest px-1">3. Insurance Policy</label>
              <label className="flex items-center justify-between p-6 bg-white border border-gray-100 rounded-[2rem] cursor-pointer hover:border-black transition-all group">
                <div className="flex items-center gap-4">
                  <span className="text-lg">🛡️</span>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest group-hover:text-black transition-colors">
                    {uploadStatus.insurance === 'done' ? '✔ Done' : uploadStatus.insurance === 'uploading' ? '⏳ Uploading' : 'Deploy Insurance Intel'}
                  </p>
                </div>
                <input type="file" hidden onChange={e => handleFileUpload(e.target.files[0], 'insurance')} />
                <div className="w-8 h-8 bg-gray-50 rounded-xl flex items-center justify-center text-gray-300 group-hover:bg-black group-hover:text-white transition-all text-xs">&uarr;</div>
              </label>
            </div>
          </div>

          <button
            onClick={handleKYCSubmit}
            disabled={isSubmittingKYC}
            className="w-full py-6 bg-black text-white text-[11px] font-black uppercase tracking-[0.3em] rounded-[2.5rem] shadow-2xl shadow-gray-200 active:scale-[0.98] transition-all disabled:bg-gray-400 mt-6"
          >
            {isSubmittingKYC ? 'Finalizing Intel...' : 'Submit for Verification'}
          </button>
        </section>

        {/* Bottom Actions */}
        <div className="pt-10 border-t border-gray-50">
          <button
            onClick={() => { localStorage.clear(); navigate('/'); }}
            className="w-full py-6 border border-black rounded-[2.5rem] text-[10px] font-black uppercase tracking-[0.2em] text-black hover:bg-black hover:text-white transition-all active:scale-95 shadow-sm"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
