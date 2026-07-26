import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Cloud, LogOut, Upload, File as FileIcon,
  Download, Trash2, Clock, RefreshCw, Search, X, Plus, HardDrive, Check, AlertCircle, Zap
} from 'lucide-react';

// ─── API helper ───────────────────────────────────────────────────────────────
const API = {
  get:      (path)           => fetch(path, { credentials: 'include' }),
  post:     (path, body)     => fetch(path, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  postForm: (path, formData) => fetch(path, { method: 'POST', credentials: 'include', body: formData }),
  postFormWithProgress: (path, formData, onProgress, onRegisterAbort) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', path);
      xhr.withCredentials = true;

      if (onRegisterAbort) {
        onRegisterAbort(() => xhr.abort());
      }

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent, event.loaded, event.total);
          }
        };
      }

      xhr.onload = () => {
        let json = {};
        try { json = JSON.parse(xhr.responseText || '{}'); } catch (e) {}
        resolve({
          ok: xhr.status >= 200 && xhr.status < 300,
          status: xhr.status,
          json: async () => json,
        });
      };

      xhr.onerror = () => reject(new TypeError('Network request failed'));
      xhr.onabort = () => reject(new Error('Upload cancelled by user'));
      xhr.send(formData);
    });
  },
  patch:    (path, body)     => fetch(path, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  delete:   (path)           => fetch(path, { method: 'DELETE', credentials: 'include' }),
};

// ─── Shared inline style constants ────────────────────────────────────────────
const S = {
  input: {
    display: 'block', width: '100%', height: '40px', padding: '0 12px',
    border: '1px solid #DADCE0', borderRadius: '8px',
    fontSize: '14px', color: '#202124', background: '#FFFFFF',
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  },
  btnPrimary: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    padding: '10px 20px', background: '#4285F4', color: '#FFFFFF',
    border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
    transition: 'background 0.15s',
  },
  btnOutline: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    padding: '10px 20px', background: '#FFFFFF', color: '#202124',
    border: '1px solid #DADCE0', borderRadius: '8px', fontSize: '14px', fontWeight: 500,
    cursor: 'pointer', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
  },
  btnIcon: {
    background: 'none', border: 'none', cursor: 'pointer',
    padding: '6px', borderRadius: '6px', color: '#5F6368',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background 0.15s',
  },
};

// ─── Utility helpers ──────────────────────────────────────────────────────────
function fmtBytes(bytes) {
  if (!bytes) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function fmtDate(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  const now  = new Date();
  const diff = now - date;
  if (diff < 86400000)   return 'Today';
  if (diff < 172800000)  return 'Yesterday';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtExpiry(isoString) {
  if (!isoString) return null;
  const expiry  = new Date(isoString);
  const now     = new Date();
  const diffMs  = expiry - now;
  if (diffMs <= 0) return 'Expired';
  const diffHrs = diffMs / (1000 * 60 * 60);
  if (diffHrs < 1) {
    const mins = Math.floor(diffMs / (1000 * 60));
    return `${mins}m left`;
  }
  return `${Math.floor(diffHrs)}h left`;
}

function userInitials(username) {
  if (!username) return '?';
  return username.substring(0, 2).toUpperCase();
}

// ─── App root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [authState, setAuthState] = useState('loading');
  const [user,      setUser]      = useState(null);

  // Auth form state
  const [authTab,    setAuthTab]    = useState('login');
  const [siUser,     setSiUser]     = useState('');
  const [siPass,     setSiPass]     = useState('');
  const [suUsername, setSuUsername] = useState('');
  const [suPass,     setSuPass]     = useState('');
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(false);

  // Dashboard state
  const [files,       setFiles]       = useState([]);
  const [activeTab,   setActiveTab]   = useState('permanent'); // 'permanent' | 'temporary'
  const [searchQuery, setSearchQuery] = useState('');

  // Multi-Drive state
  const [driveAccounts,          setDriveAccounts]          = useState([]);
  const [driveAccountsLoading,   setDriveAccountsLoading]   = useState(false);
  const [selectedDriveAccountId, setSelectedDriveAccountId] = useState(null);
  const [driveError,             setDriveError]             = useState(null);

  // Upload Destination Options State
  const [uploadIntent,   setUploadIntent]   = useState('permanent');
  const [expiresHours,   setExpiresHours]   = useState('24');
  const [isDragging,     setIsDragging]     = useState(false);

  // Multi-File Upload Queue & Concurrency State
  const [uploadQueue,        setUploadQueue]        = useState([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [maxConcurrency,    setMaxConcurrency]    = useState(3); // 1, 3, or 5 parallel uploads

  const fileInputRef = useRef(null);
  const activeAbortsRef = useRef({}); // Stores abort functions per queue item ID
  const uploadQueueRef = useRef([]);  // Synchronous ref to prevent React state updater race conditions

  // Helper to keep state and ref in sync
  const updateQueue = useCallback((updater) => {
    const next = typeof updater === 'function' ? updater(uploadQueueRef.current) : updater;
    uploadQueueRef.current = next;
    setUploadQueue(next);
  }, []);

  // ─── Auth check on mount ──────────────────────────────────────────────────
  useEffect(() => {
    API.get('/api/v1/auth/me')
      .then(async (res) => {
        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
          if (userData.has_drive_connected) setAuthState('authenticated');
          else setAuthState('needs_drive');
          if (window.location.pathname !== '/') window.history.replaceState({}, '', '/');
          if (window.location.search) {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.has('error')) setError(urlParams.get('error'));
            window.history.replaceState({}, '', window.location.pathname);
          }
        } else {
          setAuthState('unauthenticated');
          if (window.location.pathname !== '/') window.history.replaceState({}, '', '/');
        }
      })
      .catch(() => {
        setAuthState('unauthenticated');
        if (window.location.pathname !== '/') window.history.replaceState({}, '', '/');
      });
  }, []);

  const fetchFiles = useCallback(async () => {
    if (authState !== 'authenticated') return;
    try {
      const res = await API.get('/api/v1/files');
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files ?? []);
      }
    } catch (e) {
      console.error('Failed to fetch files', e);
    }
  }, [authState]);

  const fetchDriveAccounts = useCallback(async () => {
    if (authState !== 'authenticated') return;
    setDriveAccountsLoading(true);
    setDriveError(null);
    try {
      const res = await API.get('/api/v1/drive/accounts');
      if (res.ok) {
        const data = await res.json();
        const accounts = data.accounts ?? [];
        setDriveAccounts(accounts);
        const def = accounts.find(a => a.is_default) ?? accounts[0];
        if (def) setSelectedDriveAccountId(def.id);
      }
    } catch (e) {
      console.error('Failed to fetch drive accounts', e);
    } finally {
      setDriveAccountsLoading(false);
    }
  }, [authState]);

  useEffect(() => {
    if (authState === 'authenticated') {
      fetchFiles();
      fetchDriveAccounts();
    }
  }, [authState, fetchFiles, fetchDriveAccounts]);

  const onAuth = (userData) => {
    setUser(userData);
    if (userData.has_drive_connected) setAuthState('authenticated');
    else setAuthState('needs_drive');
  };

  // ─── Parallel Worker Pool Queue Processor ────────────────────────────────
  const processQueue = useCallback(async () => {
    if (isProcessingQueue) return;
    setIsProcessingQueue(true);

    const runWorker = async () => {
      while (true) {
        // Synchronously find next pending item in Ref
        const pendingIdx = uploadQueueRef.current.findIndex(item => item.status === 'pending');
        if (pendingIdx === -1) break; // No pending items left for this worker

        const targetItem = uploadQueueRef.current[pendingIdx];

        // Synchronously mark item as uploading in Ref to claim it before other workers look
        const updatedQueue = [...uploadQueueRef.current];
        updatedQueue[pendingIdx] = { ...targetItem, status: 'uploading', progressPct: 0 };
        updateQueue(updatedQueue);

        try {
          const form = new FormData();
          form.append('upload', targetItem.file);
          form.append('intent', targetItem.intent);
          if (targetItem.intent === 'permanent' && targetItem.driveAccountId) {
            form.append('drive_account_id', targetItem.driveAccountId);
          }
          if (targetItem.intent === 'temporary') {
            form.append('expiry_hours', targetItem.expiresHours);
          }

          const res = await API.postFormWithProgress(
            '/api/v1/files',
            form,
            (pct, loaded, total) => {
              const idx = uploadQueueRef.current.findIndex(i => i.id === targetItem.id);
              if (idx !== -1) {
                const next = [...uploadQueueRef.current];
                next[idx] = { ...next[idx], progressPct: pct, loaded, total };
                updateQueue(next);
              }
            },
            (abortFn) => {
              activeAbortsRef.current[targetItem.id] = abortFn;
            }
          );

          delete activeAbortsRef.current[targetItem.id];

          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.detail ?? `Upload failed (${res.status})`);
          }

          // Mark completed
          const idx = uploadQueueRef.current.findIndex(i => i.id === targetItem.id);
          if (idx !== -1) {
            const next = [...uploadQueueRef.current];
            next[idx] = { ...next[idx], status: 'completed', progressPct: 100 };
            updateQueue(next);
          }
          fetchFiles();
          fetchDriveAccounts();
        } catch (err) {
          delete activeAbortsRef.current[targetItem.id];
          const isCancelled = err.message?.includes('cancelled');
          const idx = uploadQueueRef.current.findIndex(i => i.id === targetItem.id);
          if (idx !== -1) {
            const next = [...uploadQueueRef.current];
            next[idx] = {
              ...next[idx],
              status: isCancelled ? 'cancelled' : 'error',
              errorMsg: isCancelled ? null : err.message
            };
            updateQueue(next);
          }
        }
      }
    };

    // Spawn maxConcurrency worker loops
    const workers = Array.from({ length: maxConcurrency }, () => runWorker());
    await Promise.all(workers);
    setIsProcessingQueue(false);
  }, [isProcessingQueue, maxConcurrency, fetchFiles, fetchDriveAccounts, updateQueue]);

  // Auto-start queue worker pool when pending items exist
  useEffect(() => {
    const hasPending = uploadQueue.some(item => item.status === 'pending');
    if (hasPending && !isProcessingQueue) {
      processQueue();
    }
  }, [uploadQueue, isProcessingQueue, processQueue]);

  function addFilesToQueue(fileList) {
    if (!fileList || fileList.length === 0) return;
    const newItems = Array.from(fileList).map((file, idx) => ({
      id: `q-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
      file: file,
      intent: uploadIntent,
      driveAccountId: uploadIntent === 'permanent' ? selectedDriveAccountId : null,
      expiresHours: expiresHours,
      status: 'pending',
      progressPct: 0,
      loaded: 0,
      total: file.size,
      errorMsg: null,
    }));
    updateQueue(prev => [...prev, ...newItems]);
  }

  function cancelOrRemoveQueueItem(itemId) {
    if (activeAbortsRef.current[itemId]) {
      try {
        activeAbortsRef.current[itemId]();
      } catch (e) {}
      delete activeAbortsRef.current[itemId];
    }
    updateQueue(prev => prev.filter(item => item.id !== itemId));
  }

  function clearCompletedQueue() {
    updateQueue(prev => prev.filter(item => item.status !== 'completed' && item.status !== 'cancelled'));
  }

  function retryFailedQueue() {
    updateQueue(prev => prev.map(item => (item.status === 'error' || item.status === 'cancelled') ? { ...item, status: 'pending', errorMsg: null, progressPct: 0 } : item));
  }

  // Aggregate storage calculations
  const totalUsedBytes = driveAccounts.reduce((acc, a) => acc + (a.storage?.used_bytes || 0), 0);
  const totalLimitBytes = driveAccounts.reduce((acc, a) => acc + (a.storage?.limit_bytes || 0), 0);
  const totalUsagePct = totalLimitBytes > 0 ? Math.min(Math.round((totalUsedBytes / totalLimitBytes) * 100), 100) : 0;

  // Queue progress aggregates
  const completedCount = uploadQueue.filter(i => i.status === 'completed').length;
  const uploadingCount = uploadQueue.filter(i => i.status === 'uploading').length;
  const totalQueueCount = uploadQueue.length;
  const totalQueueBytes = uploadQueue.reduce((acc, i) => acc + i.total, 0);
  const loadedQueueBytes = uploadQueue.reduce((acc, i) => acc + (i.status === 'completed' ? i.total : (i.loaded || 0)), 0);
  const overallQueuePct = totalQueueBytes > 0 ? Math.min(Math.round((loadedQueueBytes / totalQueueBytes) * 100), 100) : 0;

  // ─── Handlers ─────────────────────────────────────────────────────────────
  async function handleSignIn(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res  = await API.post('/api/v1/auth/login', { username: siUser, password: siPass });
      const data = await res.json();
      if (!res.ok) { setError(data.detail ?? 'Login failed.'); return; }
      onAuth(data);
    } catch { setError('Network error. Please try again.'); }
    finally   { setLoading(false); }
  }

  async function handleSignUp(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res  = await API.post('/api/v1/auth/register', { username: suUsername, password: suPass });
      const data = await res.json();
      if (!res.ok) { setError(data.detail ?? 'Registration failed.'); return; }
      onAuth(data);
    } catch { setError('Network error. Please try again.'); }
    finally   { setLoading(false); }
  }

  async function handleLogout() {
    await API.post('/api/v1/auth/logout', {});
    setAuthState('unauthenticated');
    setUser(null);
  }

  async function handleDelete(file) {
    const msg = file.provider === 'google_drive'
      ? `Delete "${file.filename}" from Google Drive? This cannot be undone.`
      : `Delete "${file.filename}" from temporary storage? This cannot be undone.`;
    if (!window.confirm(msg)) return;
    const res = await API.delete(`/api/v1/files/${file.id}`);
    if (res.ok) {
      fetchFiles();
      fetchDriveAccounts();
    } else {
      alert('Delete failed. Please try again.');
    }
  }

  function handleDownload(file) {
    window.open(`/api/v1/files/${file.id}/download`, '_blank');
  }

  async function handleSetDefaultDrive(accountId) {
    setDriveError(null);
    try {
      const res = await API.patch(`/api/v1/drive/accounts/${accountId}/default`, {});
      if (res.ok) {
        fetchDriveAccounts();
      } else {
        const data = await res.json().catch(() => ({}));
        setDriveError(data.detail ?? 'Failed to set default Drive account.');
      }
    } catch (e) {
      setDriveError('Failed to set default Drive account.');
    }
  }

  async function handleDisconnectDrive(account) {
    if (!window.confirm(`Disconnect Google account (${account.account_email})?`)) return;
    setDriveError(null);
    try {
      const res = await API.delete(`/api/v1/drive/accounts/${account.id}`);
      if (res.ok) {
        fetchDriveAccounts();
      } else {
        const data = await res.json().catch(() => ({}));
        setDriveError(data.detail ?? 'Failed to disconnect Drive account.');
      }
    } catch (e) {
      setDriveError('Failed to disconnect Drive account.');
    }
  }

  // ─── Loading screen ───────────────────────────────────────────────────────
  if (authState === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: '#F8F9FA', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
        <div style={{ background: '#4285F4', borderRadius: '12px', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Cloud color="white" size={24} />
        </div>
        <RefreshCw size={18} style={{ color: '#9AA0A6' }} className="animate-spin-slow" />
      </div>
    );
  }

  // ─── Auth page (split-screen) ─────────────────────────────────────────────
  if (authState === 'unauthenticated') {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>

        {/* Left brand panel — desktop only */}
        <div
          className="hidden lg:flex"
          style={{
            flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '48px', background: 'linear-gradient(145deg, #EEF2FF 0%, #F5F7FF 50%, #FFFFFF 100%)',
          }}
        >
          <div style={{ textAlign: 'center', maxWidth: '300px' }}>
            <div style={{ background: '#4285F4', borderRadius: '18px', width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <Cloud color="white" size={30} />
            </div>
            <h1 style={{ fontSize: '40px', fontWeight: 700, color: '#202124', margin: '0 0 12px', letterSpacing: '-0.5px' }}>FlowDrive</h1>
            <p style={{ fontSize: '17px', color: '#5F6368', margin: 0, lineHeight: 1.6 }}>Your storage, one vault.</p>
          </div>
        </div>

        {/* Right form panel */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', padding: '48px 24px' }}>
          <div style={{ width: '100%', maxWidth: '360px' }}>

            {/* Mobile logo */}
            <div className="flex lg:hidden" style={{ alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
              <div style={{ background: '#4285F4', borderRadius: '10px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Cloud color="white" size={18} />
              </div>
              <span style={{ fontWeight: 700, fontSize: '18px', color: '#202124' }}>FlowDrive</span>
            </div>

            <h2 style={{ fontSize: '22px', fontWeight: 600, color: '#202124', margin: '0 0 4px' }}>
              {authTab === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p style={{ fontSize: '14px', color: '#5F6368', margin: '0 0 24px' }}>
              {authTab === 'login' ? 'Sign in to access your files.' : 'Get started with FlowDrive.'}
            </p>

            {/* Error banner */}
            {error && (
              <div style={{ background: '#FDE8E8', border: '1px solid #F5C6C6', borderRadius: '8px', padding: '11px 14px', fontSize: '13px', color: '#C5221F', marginBottom: '20px' }}>
                {error === 'oauth_failed' ? 'Google sign-in failed. Please try again.' : error}
              </div>
            )}

            {/* Tab switcher */}
            <div style={{ display: 'flex', background: '#F1F3F4', borderRadius: '8px', padding: '3px', marginBottom: '20px' }}>
              {[{ id: 'login', label: 'Log in' }, { id: 'signup', label: 'Sign up' }].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => { setAuthTab(id); setError(''); }}
                  style={{
                    flex: 1, height: '34px', borderRadius: '6px', fontSize: '14px', fontWeight: 500,
                    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    background: authTab === id ? '#FFFFFF' : 'transparent',
                    color:      authTab === id ? '#202124' : '#5F6368',
                    boxShadow:  authTab === id ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Login form */}
            {authTab === 'login' ? (
              <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label htmlFor="si-user" style={{ fontSize: '13px', fontWeight: 500, color: '#202124', display: 'block', marginBottom: '6px' }}>Username</label>
                  <input id="si-user" type="text" placeholder="your_username" autoComplete="username" value={siUser} onChange={e => setSiUser(e.target.value)} required style={S.input} />
                </div>
                <div>
                  <label htmlFor="si-pass" style={{ fontSize: '13px', fontWeight: 500, color: '#202124', display: 'block', marginBottom: '6px' }}>Password</label>
                  <input id="si-pass" type="password" placeholder="••••••••" autoComplete="current-password" value={siPass} onChange={e => setSiPass(e.target.value)} required style={S.input} />
                </div>
                <button type="submit" disabled={loading} style={{ ...S.btnPrimary, marginTop: '4px', opacity: loading ? 0.72 : 1 }}>
                  {loading && <RefreshCw size={14} className="animate-spin" />}
                  Log in
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label htmlFor="su-username" style={{ fontSize: '13px', fontWeight: 500, color: '#202124', display: 'block', marginBottom: '6px' }}>Username</label>
                  <input id="su-username" type="text" placeholder="cool_username" autoComplete="username" value={suUsername} onChange={e => setSuUsername(e.target.value)} required pattern="[a-zA-Z0-9_]+" style={S.input} />
                </div>
                <div>
                  <label htmlFor="su-pass" style={{ fontSize: '13px', fontWeight: 500, color: '#202124', display: 'block', marginBottom: '6px' }}>
                    Password <span style={{ fontWeight: 400, color: '#5F6368' }}>(min 8 chars)</span>
                  </label>
                  <input id="su-pass" type="password" placeholder="••••••••" autoComplete="new-password" value={suPass} onChange={e => setSuPass(e.target.value)} required minLength={8} style={S.input} />
                </div>
                <button type="submit" disabled={loading} style={{ ...S.btnPrimary, marginTop: '4px', opacity: loading ? 0.72 : 1 }}>
                  {loading && <RefreshCw size={14} className="animate-spin" />}
                  Create account
                </button>
              </form>
            )}

            <p style={{ fontSize: '12px', color: '#9AA0A6', textAlign: 'center', marginTop: '20px' }}>
              By continuing you agree to FlowDrive's terms.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Connect Google Drive page ────────────────────────────────────────────
  if (authState === 'needs_drive') {
    return (
      <div style={{ minHeight: '100vh', background: '#F8F9FA', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ background: '#FFFFFF', border: '1px solid #DADCE0', borderRadius: '16px', padding: '40px 32px', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
          <div style={{ background: '#4285F4', borderRadius: '14px', width: '52px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Cloud color="white" size={26} />
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#202124', margin: '0 0 10px' }}>Link Google Drive</h1>
          <p style={{ fontSize: '14px', color: '#5F6368', margin: '0 0 6px', lineHeight: 1.6 }}>
            Welcome, <strong>{user?.username}</strong>. FlowDrive needs your Google account to store permanent files in your own Drive.
          </p>
          <p style={{ fontSize: '12px', color: '#9AA0A6', margin: '0 0 28px' }}>We only request access to files FlowDrive creates.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button onClick={() => { window.location.href = '/api/v1/auth/google/connect'; }} style={S.btnPrimary}>
              <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="currentColor" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
                <path fill="currentColor" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.32-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
                <path fill="currentColor" d="M11.68 28.18A13.93 13.93 0 0 1 10.7 24c0-1.45.25-2.86.69-4.18v-5.7H4.34A23.93 23.93 0 0 0 0 24c0 3.88.93 7.55 2.56 10.81l7.12-5.52z" />
                <path fill="currentColor" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.34 5.7C13.42 14.62 18.27 10.75 24 10.75z" />
              </svg>
              Connect Google Account
            </button>
            <button onClick={handleLogout} style={S.btnOutline}>
              <LogOut size={14} /> Log Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Dashboard ────────────────────────────────────────────────────────────
  const filteredFiles = files.filter(f => {
    if (f.intent !== activeTab) return false;
    if (searchQuery && !f.filename.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const dropZoneClass = ['drop-zone', isDragging ? 'drag-over' : '']
    .filter(Boolean).join(' ');

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FA' }}>

      {/* ─── Top Nav ──────────────────────────────────────────────────────────── */}
      <nav style={{ background: '#FFFFFF', borderBottom: '1px solid #DADCE0', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#4285F4', borderRadius: '10px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Cloud color="white" size={16} />
            </div>
            <span style={{ fontWeight: 700, fontSize: '16px', color: '#202124' }}>FlowDrive</span>
          </div>

          {/* User + logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '28px', height: '28px', background: '#4285F4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#FFFFFF', flexShrink: 0, letterSpacing: '0.02em' }}>
                {userInitials(user?.username)}
              </div>
              <span style={{ fontSize: '14px', color: '#5F6368', fontWeight: 500 }}>{user?.username}</span>
            </div>
            <button
              id="logout-btn"
              onClick={handleLogout}
              title="Log out"
              style={S.btnIcon}
              onMouseEnter={e => e.currentTarget.style.background = '#F1F3F4'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </nav>

      {/* ─── Main Content Container ───────────────────────────────────────────── */}
      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* ─── TOP SECTION: Total Statistics Bar ─────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '32px' }}>

          {/* Card 1: Total Storage Capacity */}
          <div style={{ background: '#FFFFFF', border: '1px solid #DADCE0', borderRadius: '16px', padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
              <div style={{ width: '36px', height: '36px', background: '#EEF4FF', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <HardDrive size={18} color="#4285F4" />
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#5F6368', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Storage Capacity</span>
              </div>
              <span style={{ fontSize: '14px', fontWeight: 700, color: totalUsagePct > 85 ? '#EA4335' : '#4285F4' }}>
                {totalUsagePct}% filled
              </span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#202124', marginBottom: '8px' }}>
              {fmtBytes(totalUsedBytes)} <span style={{ fontSize: '13px', fontWeight: 400, color: '#5F6368' }}>of {totalLimitBytes ? fmtBytes(totalLimitBytes) : 'Unlimited'}</span>
            </div>
            {/* Aggregate Storage Line Bar */}
            <div style={{ height: '8px', background: '#E8EAED', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${totalUsagePct}%`, background: totalUsagePct > 85 ? '#EA4335' : '#4285F4', borderRadius: '4px', transition: 'width 0.3s ease' }} />
            </div>
          </div>

          {/* Card 2: Connected Google Drives */}
          <div style={{ background: '#FFFFFF', border: '1px solid #DADCE0', borderRadius: '16px', padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ width: '36px', height: '36px', background: '#EEF4FF', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Cloud size={18} color="#4285F4" />
              </div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#5F6368', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Connected Google Drives</span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#202124', marginBottom: '4px' }}>
              {driveAccounts.length} Active {driveAccounts.length === 1 ? 'Drive' : 'Drives'}
            </div>
            <p style={{ fontSize: '13px', color: '#5F6368', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Primary: {driveAccounts.find(a => a.is_default)?.account_email || 'None'}
            </p>
          </div>

          {/* Card 3: Total Files Stored */}
          <div style={{ background: '#FFFFFF', border: '1px solid #DADCE0', borderRadius: '16px', padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ width: '36px', height: '36px', background: '#EEF4FF', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileIcon size={18} color="#4285F4" />
              </div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#5F6368', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Files Stored</span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#202124', marginBottom: '4px' }}>
              {files.length} {files.length === 1 ? 'File' : 'Files'}
            </div>
            <p style={{ fontSize: '13px', color: '#5F6368', margin: 0 }}>
              {files.filter(f => f.intent === 'permanent').length} Drive · {files.filter(f => f.intent === 'temporary').length} R2
            </p>
          </div>

        </div>

        {/* ─── TWO COLUMN LAYOUT: Left Sidebar (Drives) + Main Right Area ───── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 320px) 1fr', gap: '28px', alignItems: 'start' }} className="grid-cols-1 lg:grid-cols-[320px_1fr]">

          {/* ─── LEFT COLUMN: Connected Drives & Individual Stats ─────────────── */}
          <aside style={{ background: '#FFFFFF', border: '1px solid #DADCE0', borderRadius: '16px', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#202124', margin: 0 }}>Connected Drives</h2>
              <button
                onClick={() => { window.location.href = '/api/v1/auth/google/connect'; }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#EEF4FF', color: '#4285F4', border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                <Plus size={13} /> Add
              </button>
            </div>

            {driveError && (
              <div style={{ background: '#FDE8E8', border: '1px solid #F5C6C6', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#C5221F', marginBottom: '14px' }}>
                {driveError}
              </div>
            )}

            {driveAccountsLoading && driveAccounts.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#5F6368', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <RefreshCw size={14} className="animate-spin" /> Loading drives…
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {driveAccounts.map(account => {
                  const usagePct = account.storage?.usage_pct || 0;
                  return (
                    <div
                      key={account.id}
                      style={{
                        padding: '14px', background: '#FAFAFA',
                        border: account.is_default ? '1.5px solid #4285F4' : '1px solid #DADCE0',
                        borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '10px'
                      }}
                    >
                      {/* Account info */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {account.avatar_url ? (
                          <img src={account.avatar_url} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '32px', height: '32px', background: '#4285F4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '13px' }}>
                            {userInitials(account.display_name || account.account_email)}
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#202124', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {account.account_email}
                            </span>
                          </div>
                          {account.is_default && (
                            <span style={{ display: 'inline-block', background: '#4285F4', color: 'white', fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', textTransform: 'uppercase', marginTop: '2px' }}>
                              Default
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Individual Storage Filled Percentage Line Bar */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#5F6368', marginBottom: '4px' }}>
                          <span>{fmtBytes(account.storage.used_bytes)} / {account.storage.limit_bytes ? fmtBytes(account.storage.limit_bytes) : '∞'}</span>
                          <span style={{ fontWeight: 600, color: usagePct > 85 ? '#EA4335' : '#202124' }}>{usagePct}% filled</span>
                        </div>
                        <div style={{ height: '6px', background: '#E0E0E0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(usagePct, 100)}%`, background: usagePct > 85 ? '#EA4335' : '#4285F4', borderRadius: '3px', transition: 'width 0.3s ease' }} />
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                        {!account.is_default && (
                          <button
                            onClick={() => handleSetDefaultDrive(account.id)}
                            style={{ flex: 1, background: '#FFFFFF', border: '1px solid #DADCE0', color: '#5F6368', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                          >
                            Set Default
                          </button>
                        )}
                        <button
                          onClick={() => handleDisconnectDrive(account)}
                          style={{ flex: account.is_default ? 1 : 'none', background: '#FFFFFF', border: '1px solid #DADCE0', color: '#EA4335', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          Disconnect
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>

          {/* ─── RIGHT COLUMN: Upload Hero Dropzone & Recent Files Table ───────── */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

            {/* ─── Destination Options & Multi-File Hero Drop Zone ─────────────── */}
            <div style={{ background: '#FFFFFF', border: '1px solid #DADCE0', borderRadius: '16px', padding: '24px' }}>

              {/* Destination picker */}
              <p style={{ fontSize: '11px', fontWeight: 600, color: '#9AA0A6', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Target Destination for New Files</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                {[
                  { value: 'permanent', label: 'Permanent',  sub: 'Google Drive',              icon: <Cloud  size={18} color={uploadIntent === 'permanent'  ? '#4285F4' : '#9AA0A6'} /> },
                  { value: 'temporary', label: 'Temporary',  sub: 'Cloudflare R2 · auto-deletes', icon: <Clock size={18} color={uploadIntent === 'temporary'  ? '#4285F4' : '#9AA0A6'} /> },
                ].map(({ value, label, sub, icon }) => (
                  <button
                    key={value}
                    id={`dest-${value}`}
                    onClick={() => setUploadIntent(value)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 16px', borderRadius: '10px', textAlign: 'left',
                      border:      uploadIntent === value ? '1.5px solid #4285F4' : '1.5px solid #DADCE0',
                      background:  uploadIntent === value ? '#EEF4FF' : '#FAFAFA',
                      cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                    }}
                  >
                    {icon}
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: 600, color: '#202124', margin: 0 }}>{label}</p>
                      <p style={{ fontSize: '12px', color: '#5F6368', margin: 0 }}>{sub}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Target Google Drive Account Selector (Permanent only) */}
              {uploadIntent === 'permanent' && driveAccounts.length > 0 && (
                <div style={{ marginBottom: '20px', background: '#FAFAFA', border: '1px solid #DADCE0', borderRadius: '10px', padding: '14px 16px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#5F6368', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Select Target Google Drive:
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {driveAccounts.map(account => (
                      <label
                        key={account.id}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '10px 12px', borderRadius: '8px', background: '#FFFFFF',
                          border: selectedDriveAccountId === account.id ? '1.5px solid #4285F4' : '1px solid #DADCE0',
                          cursor: 'pointer', transition: 'all 0.15s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <input
                            type="radio"
                            name="drive_account_choice"
                            value={account.id}
                            checked={selectedDriveAccountId === account.id}
                            onChange={() => setSelectedDriveAccountId(account.id)}
                            style={{ accentColor: '#4285F4' }}
                          />
                          <span style={{ fontSize: '14px', fontWeight: 500, color: '#202124' }}>{account.account_email}</span>
                          {account.is_default && (
                            <span style={{ background: '#E8F0FE', color: '#4285F4', fontSize: '10px', fontWeight: 600, padding: '1px 5px', borderRadius: '4px' }}>
                              Default
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '12px', color: '#5F6368' }}>
                          {account.storage?.usage_pct || 0}% filled
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Expiry picker (Temporary only) */}
              {uploadIntent === 'temporary' && (
                <div style={{ marginBottom: '20px' }}>
                  <label htmlFor="expiry-select" style={{ fontSize: '13px', fontWeight: 500, color: '#5F6368', display: 'block', marginBottom: '7px' }}>Expires in</label>
                  <select
                    id="expiry-select"
                    value={expiresHours}
                    onChange={e => setExpiresHours(e.target.value)}
                    style={{ ...S.input, cursor: 'pointer' }}
                  >
                    <option value="1">1 hour</option>
                    <option value="24">24 hours</option>
                    <option value="168">7 days</option>
                  </select>
                </div>
              )}

              {/* Multi-File Dropzone Box */}
              <div
                id="upload-dropzone"
                className={dropZoneClass}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files) addFilesToQueue(e.dataTransfer.files);
                }}
              >
                <div style={{ width: '64px', height: '64px', background: '#F1F3F4', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Upload size={30} color="#9AA0A6" />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontWeight: 600, fontSize: '18px', color: '#202124', margin: '0 0 6px' }}>Drop files here to add to queue</p>
                  <p style={{ fontSize: '14px', color: '#5F6368', margin: 0 }}>or click to browse multiple files from your device</p>
                </div>
                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={e => {
                    if (e.target.files) addFilesToQueue(e.target.files);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>

            {/* ─── CANCELLABLE UPLOAD QUEUE PANEL ──────────────────────────────── */}
            {uploadQueue.length > 0 && (
              <div style={{ background: '#FFFFFF', border: '1px solid #DADCE0', borderRadius: '16px', padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Upload size={18} color="#4285F4" />
                    <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#202124', margin: 0 }}>Upload Queue</h3>
                    <span style={{ background: '#EEF4FF', color: '#4285F4', fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px' }}>
                      {completedCount} / {totalQueueCount} completed {uploadingCount > 0 ? `(${uploadingCount} active)` : ''}
                    </span>
                  </div>

                  {/* Speed & Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>

                    {/* Concurrency Selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#F1F3F4', borderRadius: '8px', padding: '2px 4px' }}>
                      <Zap size={13} color="#4285F4" style={{ marginLeft: '4px' }} />
                      {[
                        { level: 1, label: '1x' },
                        { level: 3, label: '3x Parallel' },
                        { level: 5, label: '5x Turbo' },
                      ].map(({ level, label }) => (
                        <button
                          key={level}
                          onClick={() => setMaxConcurrency(level)}
                          style={{
                            padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                            border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                            background: maxConcurrency === level ? '#FFFFFF' : 'transparent',
                            color:      maxConcurrency === level ? '#4285F4' : '#5F6368',
                            boxShadow:  maxConcurrency === level ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {uploadQueue.some(i => i.status === 'completed' || i.status === 'cancelled') && (
                      <button
                        onClick={clearCompletedQueue}
                        style={{ background: '#FFFFFF', border: '1px solid #DADCE0', color: '#5F6368', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        Clear Finished
                      </button>
                    )}
                    {uploadQueue.some(i => i.status === 'error' || i.status === 'cancelled') && (
                      <button
                        onClick={retryFailedQueue}
                        style={{ background: '#EEF4FF', border: 'none', color: '#4285F4', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        Retry Failed
                      </button>
                    )}
                  </div>
                </div>

                {/* Overall Queue Progress Bar */}
                <div style={{ marginBottom: '18px', background: '#FAFAFA', border: '1px solid #DADCE0', borderRadius: '12px', padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: '#5F6368', marginBottom: '6px' }}>
                    <span>Overall Progress ({maxConcurrency}x parallel workers)</span>
                    <span>{fmtBytes(loadedQueueBytes)} of {fmtBytes(totalQueueBytes)} ({overallQueuePct}%)</span>
                  </div>
                  <div style={{ height: '8px', background: '#E0E0E0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${overallQueuePct}%`, background: '#4285F4', borderRadius: '4px', transition: 'width 0.2s ease' }} />
                  </div>
                </div>

                {/* Queue Items List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {uploadQueue.map(item => (
                    <div
                      key={item.id}
                      style={{
                        padding: '12px 16px', background: item.status === 'uploading' ? '#EEF4FF' : '#FAFAFA',
                        border: item.status === 'uploading' ? '1.5px solid #4285F4' : '1px solid #DADCE0',
                        borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                          <FileIcon size={16} color="#5F6368" style={{ flexShrink: 0 }} />
                          <span style={{ fontSize: '14px', fontWeight: 600, color: '#202124', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.file.name}
                          </span>
                          <span style={{ fontSize: '12px', color: '#5F6368', flexShrink: 0 }}>
                            ({fmtBytes(item.file.size)})
                          </span>
                        </div>

                        {/* Status Badges & Controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          {item.status === 'pending' && (
                            <span style={{ background: '#F1F3F4', color: '#5F6368', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px' }}>
                              Pending
                            </span>
                          )}
                          {item.status === 'uploading' && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#4285F4', color: 'white', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px' }}>
                              <RefreshCw size={11} className="animate-spin" /> {item.progressPct}%
                            </span>
                          )}
                          {item.status === 'completed' && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#E6F4EA', color: '#137333', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px' }}>
                              <Check size={12} /> Done
                            </span>
                          )}
                          {item.status === 'cancelled' && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#F1F3F4', color: '#5F6368', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px' }}>
                              Cancelled
                            </span>
                          )}
                          {item.status === 'error' && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#FDE8E8', color: '#C5221F', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px' }}>
                              <AlertCircle size={12} /> Failed
                            </span>
                          )}

                          {/* Cancel / Remove Cross Icon for ALL statuses (including uploading!) */}
                          <button
                            onClick={() => cancelOrRemoveQueueItem(item.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: item.status === 'uploading' ? '#EA4335' : '#9AA0A6' }}
                            title={item.status === 'uploading' ? 'Cancel active upload' : 'Remove from queue'}
                          >
                            <X size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Per-item progress bar when uploading */}
                      {item.status === 'uploading' && (
                        <div>
                          <div style={{ height: '4px', background: '#E0E0E0', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${item.progressPct}%`, background: '#4285F4', borderRadius: '2px', transition: 'width 0.15s linear' }} />
                          </div>
                        </div>
                      )}

                      {/* Error message detail */}
                      {item.status === 'error' && item.errorMsg && (
                        <p style={{ fontSize: '12px', color: '#C5221F', margin: 0 }}>
                          {item.errorMsg}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Files Section: Tabs + Search + File Table ──────────────────── */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                {/* Tab bar */}
                <div style={{ display: 'flex', background: '#FFFFFF', border: '1px solid #DADCE0', borderRadius: '10px', padding: '4px', gap: '2px' }}>
                  {[
                    { value: 'permanent', label: 'Google Drive' },
                    { value: 'temporary', label: 'Cloudflare R2' },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      id={`tab-${value}`}
                      onClick={() => setActiveTab(value)}
                      style={{
                        padding: '7px 18px', borderRadius: '7px', fontSize: '14px', fontWeight: 500,
                        border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                        background: activeTab === value ? '#EEF4FF' : 'transparent',
                        color:      activeTab === value ? '#4285F4' : '#5F6368',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Search */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search size={14} style={{ position: 'absolute', left: '12px', color: '#9AA0A6', pointerEvents: 'none' }} />
                  <input
                    id="search-files"
                    type="search"
                    placeholder="Search files…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ ...S.input, paddingLeft: '34px', width: '200px' }}
                  />
                </div>
              </div>

              {/* Table Container */}
              <div style={{ background: '#FFFFFF', border: '1px solid #DADCE0', borderRadius: '14px', overflow: 'hidden' }}>

                {/* Table Header Bar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #DADCE0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#202124' }}>
                      {activeTab === 'permanent' ? 'Google Drive Files' : 'Cloudflare R2 Files'}
                    </span>
                    <span style={{ background: '#F1F3F4', color: '#5F6368', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px' }}>
                      {filteredFiles.length}
                    </span>
                  </div>
                  <button
                    onClick={fetchFiles}
                    title="Refresh"
                    style={S.btnIcon}
                    onMouseEnter={e => e.currentTarget.style.background = '#F1F3F4'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>

                {/* Empty state */}
                {filteredFiles.length === 0 ? (
                  <div style={{ padding: '56px 24px', textAlign: 'center' }}>
                    <div style={{ width: '48px', height: '48px', background: '#F1F3F4', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                      {activeTab === 'permanent'
                        ? <Cloud size={22} color="#9AA0A6" />
                        : <Clock size={22} color="#9AA0A6" />}
                    </div>
                    <p style={{ fontSize: '15px', fontWeight: 500, color: '#5F6368', margin: '0 0 6px' }}>
                      {searchQuery ? 'No matching files' : `No ${activeTab} files yet`}
                    </p>
                    {!searchQuery && (
                      <p style={{ fontSize: '13px', color: '#9AA0A6', margin: 0 }}>
                        Drop files above to get started
                      </p>
                    )}
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', minWidth: '580px', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #F1F3F4' }}>
                          {[
                            'Name',
                            ...(activeTab === 'permanent' ? ['Target Drive'] : []),
                            'Uploaded',
                            'Size',
                            ...(activeTab === 'temporary' ? ['Expires'] : []),
                            ''
                          ].map((h, i, arr) => (
                            <th
                              key={i}
                              style={{
                                padding: '10px 20px',
                                textAlign: i === arr.length - 1 ? 'right' : 'left',
                                fontSize: '11px', fontWeight: 600, color: '#9AA0A6',
                                textTransform: 'uppercase', letterSpacing: '0.05em',
                              }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredFiles.map((f, idx) => {
                          const expiry = fmtExpiry(f.expires_at);
                          const isExpiringSoon = expiry && expiry.includes('m left');
                          return (
                            <tr
                              key={f.id}
                              style={{ borderBottom: idx < filteredFiles.length - 1 ? '1px solid #F8F9FA' : 'none', transition: 'background 0.1s' }}
                              onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              {/* Name */}
                              <td style={{ padding: '12px 20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <div style={{ width: '34px', height: '34px', background: '#F1F3F4', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <FileIcon size={15} color="#9AA0A6" />
                                  </div>
                                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#202124', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                                    {f.filename}
                                  </span>
                                </div>
                              </td>

                              {/* Target Drive (permanent only) */}
                              {activeTab === 'permanent' && (
                                <td style={{ padding: '12px 20px', fontSize: '13px', color: '#4285F4', fontWeight: 500 }}>
                                  {f.drive_account_email || 'Google Drive'}
                                </td>
                              )}

                              {/* Uploaded */}
                              <td style={{ padding: '12px 20px', fontSize: '13px', color: '#5F6368' }}>{fmtDate(f.created_at)}</td>

                              {/* Size */}
                              <td style={{ padding: '12px 20px', fontSize: '13px', color: '#5F6368' }}>{fmtBytes(f.size_bytes)}</td>

                              {/* Expires (temporary only) */}
                              {activeTab === 'temporary' && (
                                <td style={{ padding: '12px 20px', fontSize: '13px', fontWeight: isExpiringSoon ? 600 : 400, color: isExpiringSoon ? '#F29900' : '#5F6368' }}>
                                  {expiry || '—'}
                                </td>
                              )}

                              {/* Actions */}
                              <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                                  <button
                                    onClick={() => handleDownload(f)}
                                    title="Download"
                                    style={S.btnIcon}
                                    onMouseEnter={e => e.currentTarget.style.background = '#F1F3F4'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                  >
                                    <Download size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(f)}
                                    title="Delete"
                                    style={{ ...S.btnIcon, color: '#EA4335' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#FDE8E8'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
