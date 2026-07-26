import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Cloud, LogOut, Upload, File as FileIcon,
  Download, Trash2, Clock, RefreshCw, Search, X, Plus, HardDrive, Check, AlertCircle, Zap, Shield, Sparkles, CheckCircle2, Orbit, ChevronDown
} from 'lucide-react';
import Prism from './Prism';

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

// ─── Antigravity Glassmorphic Theme Tokens & Inline Styles ───────────────────
const S = {
  input: {
    display: 'block', width: '100%', height: '42px', padding: '0 14px',
    border: '1px solid rgba(255, 255, 255, 0.14)', borderRadius: '8px',
    fontSize: '14px', color: '#f8fafc', background: 'rgba(15, 25, 48, 0.45)',
    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
    transition: 'all 0.2s ease',
  },
  btnPrimary: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    padding: '10px 20px', background: 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)', color: '#FFFFFF',
    border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '8px', fontSize: '15px', fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
    boxShadow: '0 0 25px rgba(99, 102, 241, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)', transition: 'all 0.2s ease',
  },
  btnDark: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    padding: '10px 20px', background: 'rgba(30, 41, 59, 0.7)', color: '#FFFFFF',
    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.14)', borderRadius: '8px', fontSize: '15px', fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
    transition: 'all 0.2s ease',
  },
  btnOutline: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    padding: '10px 20px', background: 'rgba(255, 255, 255, 0.05)', color: '#f8fafc',
    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
    transition: 'all 0.2s ease',
  },
  btnIcon: {
    background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.12)', cursor: 'pointer',
    padding: '7px', borderRadius: '8px', color: '#a5b4fc',
    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.2s ease', flexShrink: 0,
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
  const [showAllFiles, setShowAllFiles] = useState(false);

  useEffect(() => {
    setShowAllFiles(false);
  }, [activeTab, searchQuery]);

  // Multi-Drive state
  const [driveAccounts,          setDriveAccounts]          = useState([]);
  const [driveAccountsLoading,   setDriveAccountsLoading]   = useState(false);
  const [selectedDriveAccountId, setSelectedDriveAccountId] = useState(null);
  const [driveError,             setDriveError]             = useState(null);
  const [showAllDrives,          setShowAllDrives]          = useState(false);

  // Upload Destination Options State
  const [uploadIntent,   setUploadIntent]   = useState('permanent');
  const [expiresHours,   setExpiresHours]   = useState('24');
  const [isDragging,     setIsDragging]     = useState(false);
  const [isExpiryDropdownOpen, setIsExpiryDropdownOpen] = useState(false);

  // Multi-File Upload Queue & Concurrency State
  const [uploadQueue,        setUploadQueue]        = useState([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [maxConcurrency,    setMaxConcurrency]    = useState(3); // 1, 3, or 5 parallel uploads

  // Custom Modal & Toast States
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Delete',
    danger: true,
    onConfirm: null,
  });

  const [toast, setToast] = useState({
    isOpen: false,
    message: '',
    type: 'success', // 'success' | 'error' | 'info'
  });

  const toastTimerRef = useRef(null);

  const showToast = useCallback((message, type = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ isOpen: true, message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(prev => ({ ...prev, isOpen: false }));
    }, 4000);
  }, []);

  function promptConfirm({ title, message, confirmText = 'Delete', danger = true, onConfirm }) {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      confirmText,
      danger,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        if (onConfirm) await onConfirm();
      }
    });
  }

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
        const pendingIdx = uploadQueueRef.current.findIndex(item => item.status === 'pending');
        if (pendingIdx === -1) break;

        const targetItem = uploadQueueRef.current[pendingIdx];

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

    const workers = Array.from({ length: maxConcurrency }, () => runWorker());
    await Promise.all(workers);
    setIsProcessingQueue(false);
  }, [isProcessingQueue, maxConcurrency, fetchFiles, fetchDriveAccounts, updateQueue]);

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

  function handleLogout() {
    promptConfirm({
      title: 'Log Out',
      message: 'Are you sure you want to log out of your FlowDrive space workspace?',
      confirmText: 'Log Out',
      danger: true,
      onConfirm: async () => {
        try {
          await API.post('/api/v1/auth/logout', {});
          setAuthState('unauthenticated');
          setUser(null);
          showToast('Logged out successfully', 'info');
        } catch (e) {
          showToast('Failed to log out. Please try again.', 'error');
        }
      }
    });
  }

  function handleDelete(file) {
    if (!file || !file.id) return;
    const isDrive = file.provider === 'google_drive';
    
    promptConfirm({
      title: 'Delete File',
      message: `Are you sure you want to delete "${file.filename}" from ${isDrive ? 'Google Drive' : 'temporary storage'}? This action cannot be undone.`,
      confirmText: 'Delete File',
      danger: true,
      onConfirm: async () => {
        try {
          const res = await API.delete(`/api/v1/files/${file.id}`);
          if (res.ok || res.status === 204) {
            setFiles(prev => prev.filter(f => f.id !== file.id));
            showToast(`"${file.filename}" deleted successfully`, 'success');
            fetchFiles();
            fetchDriveAccounts();
          } else {
            const errData = await res.json().catch(() => ({}));
            showToast(`Delete failed: ${errData.detail || 'Server error'}`, 'error');
          }
        } catch (err) {
          showToast('Delete failed due to network error.', 'error');
        }
      }
    });
  }

  function handleDownload(file) {
    if (!file || !file.id) return;
    window.open(`/api/v1/files/${file.id}/download`, '_blank');
  }

  async function handleSetDefaultDrive(accountId) {
    setDriveError(null);
    try {
      const res = await API.patch(`/api/v1/drive/accounts/${accountId}/default`, {});
      if (res.ok) {
        showToast('Default Google Drive updated', 'success');
        fetchDriveAccounts();
      } else {
        const data = await res.json().catch(() => ({}));
        setDriveError(data.detail ?? 'Failed to set default Drive account.');
        showToast('Failed to update default Drive', 'error');
      }
    } catch (e) {
      setDriveError('Failed to set default Drive account.');
      showToast('Failed to update default Drive', 'error');
    }
  }

  function handleDisconnectDrive(account) {
    promptConfirm({
      title: 'Disconnect Google Drive',
      message: `Are you sure you want to disconnect Google account (${account.account_email})?`,
      confirmText: 'Disconnect Drive',
      danger: true,
      onConfirm: async () => {
        setDriveError(null);
        try {
          const res = await API.delete(`/api/v1/drive/accounts/${account.id}`);
          if (res.ok) {
            showToast(`Disconnected ${account.account_email}`, 'success');
            fetchDriveAccounts();
          } else {
            const data = await res.json().catch(() => ({}));
            setDriveError(data.detail ?? 'Failed to disconnect Drive account.');
            showToast(data.detail ?? 'Failed to disconnect Drive account.', 'error');
          }
        } catch (e) {
          setDriveError('Failed to disconnect Drive account.');
          showToast('Failed to disconnect Drive account.', 'error');
        }
      }
    });
  }

  // ─── Loading screen ───────────────────────────────────────────────────────
  if (authState === 'loading') {
    return (
      <div className="space-canvas" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', minHeight: '100vh', position: 'relative' }}>
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
          <Prism animationType="rotate" timeScale={0.5} height={3.5} baseWidth={5.5} scale={3.6} hueShift={0} colorFrequency={1} noise={0} glow={1} />
        </div>
        <div style={{ background: 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)', borderRadius: '16px', width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 30px rgba(99, 102, 241, 0.5)', zIndex: 1 }}>
          <Orbit color="white" size={32} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f8fafc', fontSize: '15px', fontWeight: 600, zIndex: 1 }}>
          <RefreshCw size={18} style={{ color: '#38bdf8' }} className="animate-spin-slow" />
          <span>Opening Antigravity space workspace…</span>
        </div>
      </div>
    );
  }

  // ─── Auth page (Antigravity Space Canvas) ──────────────────────────────────
  if (authState === 'unauthenticated') {
    return (
      <div className="space-canvas" style={{ display: 'flex', minHeight: '100vh', position: 'relative', overflow: 'hidden', alignItems: 'center' }}>
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
          <Prism animationType="rotate" timeScale={0.5} height={3.5} baseWidth={5.5} scale={3.6} hueShift={0} colorFrequency={1} noise={0} glow={1} />
        </div>

        {/* Left brand panel — desktop only */}
        <div
          className="hidden lg:flex"
          style={{
            flex: 1.2, flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '64px 48px', position: 'relative', zIndex: 1
          }}
        >
          <div style={{ maxWidth: '560px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
              <div style={{ background: 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)', borderRadius: '18px', width: '64px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 30px rgba(99, 102, 241, 0.5)' }}>
                <Orbit color="white" size={32} />
              </div>
              <h1 style={{ fontSize: '58px', fontWeight: 800, margin: 0, letterSpacing: '-1px' }} className="text-gradient">FlowDrive</h1>
            </div>

            <p style={{ fontSize: '20px', color: '#94a3b8', margin: '0 0 40px', lineHeight: 1.6, fontWeight: 400 }}>
              Your storage, elevated into the cloud universe. Stream permanent files directly into Google Drive, or deploy temporary shares via Cloudflare R2.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                { title: 'Google Drive Multi-Account Routing', desc: 'Connect unlimited Google accounts & stream targeted storage' },
                { title: 'Cloudflare R2 Temporary Shares', desc: 'Auto-expiring space links for 1h, 24h, or 7 days' },
                { title: 'Multi-Threaded Turbo Parallel Pool', desc: 'Accelerate uploads up to 5x with live pause and instant cancels' },
              ].map((feat, i) => (
                <div key={i} className="paper-card" style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', padding: '18px 24px' }}>
                  <div style={{ background: 'rgba(99, 102, 241, 0.2)', borderRadius: '10px', padding: '8px', color: '#38bdf8', marginTop: '2px' }}>
                    <CheckCircle2 size={18} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', margin: 0 }}>{feat.title}</h4>
                    <p style={{ fontSize: '14px', color: '#94a3b8', margin: '3px 0 0' }}>{feat.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right form panel — enlarged card & inputs */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 32px', zIndex: 1 }}>
          <div className="paper-card" style={{ width: '100%', maxWidth: '520px', padding: '52px 44px' }}>

            {/* Mobile logo */}
            <div className="flex lg:hidden" style={{ alignItems: 'center', gap: '14px', marginBottom: '32px' }}>
              <div style={{ background: 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)', borderRadius: '14px', width: '46px', height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Orbit color="white" size={24} />
              </div>
              <span style={{ fontWeight: 800, fontSize: '28px' }} className="text-gradient">FlowDrive</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#f8fafc', margin: 0, letterSpacing: '-0.5px' }}>
                {authTab === 'login' ? 'Welcome to Space Workspace' : 'Create your Space Account'}
              </h2>
            </div>
            <p style={{ fontSize: '15px', color: '#94a3b8', margin: '0 0 28px', lineHeight: 1.5 }}>
              {authTab === 'login' ? 'Sign in to access your cloud storage universe.' : 'Get started with FlowDrive today.'}
            </p>

            {/* Error banner */}
            {error && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)',  border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', padding: '12px 16px', fontSize: '14px', color: '#fca5a5', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{error === 'oauth_failed' ? 'Google sign-in failed. Please try again.' : error}</span>
              </div>
            )}

            {/* Tab switcher */}
            <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '10px', padding: '4px', marginBottom: '28px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
              {[{ id: 'login', label: 'Log In' }, { id: 'signup', label: 'Sign Up' }].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => { setAuthTab(id); setError(''); }}
                  style={{
                    flex: 1, height: '42px', borderRadius: '8px', fontSize: '15px', fontWeight: 600,
                    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    background: authTab === id ? 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)' : 'transparent',
                    color:      authTab === id ? '#FFFFFF' : '#94a3b8',
                    boxShadow:  authTab === id ? '0 0 20px rgba(99, 102, 241, 0.4)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Login form */}
            {authTab === 'login' ? (
              <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label htmlFor="si-user" style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc', display: 'block', marginBottom: '8px' }}>Username</label>
                  <input id="si-user" type="text" placeholder="your_username" autoComplete="username" value={siUser} onChange={e => setSiUser(e.target.value)} required style={{ ...S.input, height: '48px', fontSize: '15px', padding: '0 16px' }} />
                </div>
                <div>
                  <label htmlFor="si-pass" style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc', display: 'block', marginBottom: '8px' }}>Password</label>
                  <input id="si-pass" type="password" placeholder="••••••••" autoComplete="current-password" value={siPass} onChange={e => setSiPass(e.target.value)} required style={{ ...S.input, height: '48px', fontSize: '15px', padding: '0 16px' }} />
                </div>
                <button type="submit" disabled={loading} style={{ ...S.btnPrimary, height: '48px', fontSize: '15px', marginTop: '6px', opacity: loading ? 0.72 : 1 }}>
                  {loading ? <RefreshCw size={18} className="animate-spin" /> : null}
                  Sign In to Workspace
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label htmlFor="su-username" style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc', display: 'block', marginBottom: '8px' }}>Username</label>
                  <input id="su-username" type="text" placeholder="cool_username" autoComplete="username" value={suUsername} onChange={e => setSuUsername(e.target.value)} required pattern="[a-zA-Z0-9_]+" style={{ ...S.input, height: '48px', fontSize: '15px', padding: '0 16px' }} />
                </div>
                <div>
                  <label htmlFor="su-pass" style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc', display: 'block', marginBottom: '8px' }}>
                    Password <span style={{ fontWeight: 400, color: '#94a3b8' }}>(min 8 chars)</span>
                  </label>
                  <input id="su-pass" type="password" placeholder="••••••••" autoComplete="new-password" value={suPass} onChange={e => setSuPass(e.target.value)} required minLength={8} style={{ ...S.input, height: '48px', fontSize: '15px', padding: '0 16px' }} />
                </div>
                <button type="submit" disabled={loading} style={{ ...S.btnPrimary, height: '48px', fontSize: '15px', marginTop: '6px', opacity: loading ? 0.72 : 1 }}>
                  {loading ? <RefreshCw size={18} className="animate-spin" /> : null}
                  Create Space Account
                </button>
              </form>
            )}

            <p style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', marginTop: '28px' }}>
              By continuing you agree to FlowDrive's terms of service.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Connect Google Drive page ────────────────────────────────────────────
  if (authState === 'needs_drive') {
    return (
      <div className="space-canvas" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px', position: 'relative' }}>
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
          <Prism animationType="rotate" timeScale={0.5} height={3.5} baseWidth={5.5} scale={3.6} hueShift={0} colorFrequency={1} noise={0} glow={1} />
        </div>
        <div className="paper-card" style={{ padding: '52px 44px', width: '100%', maxWidth: '500px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div style={{ background: 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)', borderRadius: '16px', width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 0 25px rgba(99, 102, 241, 0.5)' }}>
            <Cloud color="white" size={30} />
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, margin: '0 0 10px' }}  className="text-gradient">Link Google Drive Space</h1>
          <p style={{ fontSize: '14px', color: '#94a3b8', margin: '0 0 8px', lineHeight: 1.6 }}>
            Welcome, <strong style={{ color: '#f8fafc' }}>{user?.username}</strong>. Connect your Google account to store permanent files in your Drive.
          </p>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 28px' }}>We only request access to files FlowDrive creates.</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button onClick={() => { window.location.href = '/api/v1/auth/google/connect'; }} style={S.btnPrimary}>
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.28-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Connect Google Account
            </button>
            <button onClick={handleLogout} style={S.btnOutline}>
              <LogOut size={15} /> Log Out
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

  const INITIAL_FILE_LIMIT = 5;
  const displayedFiles = showAllFiles ? filteredFiles : filteredFiles.slice(0, INITIAL_FILE_LIMIT);
  const hasMoreFiles = filteredFiles.length > INITIAL_FILE_LIMIT;

  const INITIAL_DRIVE_LIMIT = 4;
  const displayedDriveAccounts = showAllDrives ? driveAccounts : driveAccounts.slice(0, INITIAL_DRIVE_LIMIT);
  const hasMoreDrives = driveAccounts.length > INITIAL_DRIVE_LIMIT;

  const dropZoneClass = ['drop-zone', isDragging ? 'drag-over' : '']
    .filter(Boolean).join(' ');

  return (
    <div className="space-canvas" style={{ color: '#f8fafc', position: 'relative' }}>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <Prism
          animationType="rotate"
          timeScale={0.5}
          height={3.5}
          baseWidth={5.5}
          scale={3.6}
          hueShift={0}
          colorFrequency={1}
          noise={0}
          glow={1}
        />
      </div>
      
      
      

      {/* ─── CUSTOM CONFIRMATION MODAL (GLASSMOPHIC SPACE) ────────────────────── */}
      {confirmModal.isOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(4, 7, 17, 0.75)',  
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
          }}
          onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        >
          <div
            className="paper-card"
            style={{
              maxWidth: '440px', width: '100%', padding: '28px',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
              position: 'relative'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '44px', height: '44px', borderRadius: '12px',
                  background: confirmModal.danger ? 'rgba(239, 68, 68, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                  color: confirmModal.danger ? '#fca5a5' : '#38bdf8',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  border: confirmModal.danger ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(99, 102, 241, 0.35)'
                }}
              >
                {confirmModal.danger ? <AlertCircle size={22} /> : <Orbit size={22} />}
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  {confirmModal.title}
                </h3>
                <span style={{ fontSize: '12px', color: '#f8fafc' }}>Antigravity Space Workspace</span>
              </div>
            </div>

            <p style={{ fontSize: '14px', color: '#94a3b8', lineHeight: 1.5, margin: '0 0 24px' }}>
              {confirmModal.message}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                style={{
                  padding: '9px 18px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.08)',
                   
                  border: '1px solid rgba(255, 255, 255, 0.14)', color: '#f8fafc', fontSize: '14px', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit'
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmModal.onConfirm}
                style={{
                  padding: '9px 18px', borderRadius: '8px',
                  background: confirmModal.danger ? '#ef4444' : '#6366f1',
                  color: '#FFFFFF', border: 'none', fontSize: '14px', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                  boxShadow: confirmModal.danger ? '0 0 20px rgba(239, 68, 68, 0.4)' : '0 0 20px rgba(99, 102, 241, 0.4)'
                }}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CUSTOM TOAST NOTIFICATION BANNER (GLASSMOPHIC SPACE) ───────────── */}
      {toast.isOpen && (
        <div
          style={{
            position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '14px 20px', borderRadius: '12px', background: 'rgba(18, 30, 54, 0.85)',
             
            border: '1px solid rgba(255, 255, 255, 0.18)',
            boxShadow: '0 15px 35px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.2)', maxWidth: '380px'
          }}
        >
          <div
            style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: toast.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
              color: toast.type === 'error' ? '#fca5a5' : '#6ee7b7',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}
          >
            {toast.type === 'error' ? <AlertCircle size={16} /> : <Check size={16} />}
          </div>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc', flex: 1 }}>
            {toast.message}
          </span>
          <button
            onClick={() => setToast(prev => ({ ...prev, isOpen: false }))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#94a3b8' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ─── Top Nav Header (Transparent Floating Glass Bar with Soft Corners) ── */}
      <div style={{ position: 'sticky', top: '16px', zIndex: 50, padding: '0 32px', boxSizing: 'border-box', marginBottom: '16px' }}>
        <nav
          className="paper-card"
          style={{
            width: '100%',
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            justify: 'space-between',
            padding: '0 28px',
            borderRadius: '20px',
            boxSizing: 'border-box',
            background: 'rgba(15, 25, 48, 0.45)',
            backdropFilter: 'blur(16px) saturate(180%)',
            WebkitBackdropFilter: 'blur(16px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
          }}
        >
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)', borderRadius: '12px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 15px rgba(99, 102, 241, 0.4)' }}>
              <Orbit color="white" size={18} />
            </div>
            <span style={{ fontWeight: 800, fontSize: '20px', letterSpacing: '-0.5px' }} className="text-gradient">FlowDrive</span>
          </div>

          {/* User + logout — locked to top-right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginLeft: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255, 255, 255, 0.06)', padding: '4px 14px 4px 6px', borderRadius: '9999px', border: '1px solid rgba(255, 255, 255, 0.14)' }}>
              <div style={{ width: '30px', height: '30px', background: 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#FFFFFF', flexShrink: 0 }}>
                {userInitials(user?.username)}
              </div>
              <span style={{ fontSize: '14px', color: '#f8fafc', fontWeight: 600 }}>{user?.username}</span>
            </div>

            <button
              id="logout-btn"
              onClick={handleLogout}
              title="Log out"
              style={S.btnIcon}
            >
              <LogOut size={16} />
            </button>
          </div>
        </nav>
      </div>

      {/* ─── Main Content Container ───────────────────────────────────────────── */}
      <main style={{ width: '100%', padding: '32px 32px 80px', position: 'relative', zIndex: 1, boxSizing: 'border-box' }}>

        {/* ─── TOP SECTION: Total Statistics Bar ─────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '32px', alignItems: 'stretch' }}>

          {/* Card 1: Total Storage Capacity */}
          <div className="paper-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', boxSizing: 'border-box' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '14px' }}>
                <div style={{ width: '40px', height: '40px', background: 'rgba(99, 102, 241, 0.25)',  borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8', flexShrink: 0, border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <HardDrive size={20} />
                </div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: totalUsagePct > 85 ? '#fca5a5' : '#38bdf8', background: totalUsagePct > 85 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.15)', padding: '4px 10px', borderRadius: '9999px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {totalUsagePct}% filled
                </span>
              </div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Total Space Capacity</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#f8fafc', marginBottom: '12px' }}>
                {fmtBytes(totalUsedBytes)} <span style={{ fontSize: '14px', fontWeight: 500, color: '#94a3b8' }}>/ {totalLimitBytes ? fmtBytes(totalLimitBytes) : 'Unlimited'}</span>
              </div>
            </div>
            {/* Aggregate Storage Line Bar */}
            <div style={{ height: '8px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${totalUsagePct}%`, background: totalUsagePct > 85 ? '#ef4444' : 'linear-gradient(90deg, #6366f1, #38bdf8)', borderRadius: '4px', transition: 'width 0.3s ease' }} />
            </div>
          </div>

          {/* Card 2: Connected Google Drives */}
          <div className="paper-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', boxSizing: 'border-box' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ width: '40px', height: '40px', background: 'rgba(99, 102, 241, 0.25)',  borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8', flexShrink: 0, border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <Cloud size={20} />
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc', background: 'rgba(99, 102, 241, 0.18)', padding: '4px 10px', borderRadius: '9999px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {driveAccounts.length} Active
                </span>
              </div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Connected Drives</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#f8fafc', marginBottom: '4px' }}>
                {driveAccounts.length} {driveAccounts.length === 1 ? 'Drive' : 'Drives'} Connected
              </div>
            </div>
            <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Primary: <span style={{ color: '#f8fafc', fontWeight: 600 }}>{driveAccounts.find(a => a.is_default)?.account_email || 'None'}</span>
            </p>
          </div>

          {/* Card 3: Total Files Stored */}
          <div className="paper-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', boxSizing: 'border-box' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ width: '40px', height: '40px', background: 'rgba(99, 102, 241, 0.25)',  borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8', flexShrink: 0, border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <FileIcon size={20} />
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc', background: 'rgba(99, 102, 241, 0.18)', padding: '4px 10px', borderRadius: '9999px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  Synced
                </span>
              </div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Total Files Stored</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#f8fafc', marginBottom: '4px' }}>
                {files.length} {files.length === 1 ? 'File' : 'Files'}
              </div>
            </div>
            <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0 }}>
              <span style={{ color: '#38bdf8', fontWeight: 600 }}>{files.filter(f => f.intent === 'permanent').length}</span> Permanent · <span style={{ color: '#f8fafc', fontWeight: 600 }}>{files.filter(f => f.intent === 'temporary').length}</span> Temp
            </p>
          </div>

        </div>

        {/* ─── TWO COLUMN LAYOUT: Left Sidebar (Drives) + Main Right Area ───── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 420px) 1fr', gap: '28px', alignItems: 'start' }} className="grid-cols-1 lg:grid-cols-[420px_1fr]">

          {/* ─── LEFT COLUMN: Connected Drives & Individual Stats ─────────────── */}
          <aside className="paper-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>Connected Drives</h2>
              <button
                onClick={() => { window.location.href = '/api/v1/auth/google/connect'; }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(99, 102, 241, 0.25)',  color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                <Plus size={14} /> Add Drive
              </button>
            </div>

            {driveError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)',  border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#fca5a5', marginBottom: '16px' }}>
                {driveError}
              </div>
            )}

            {driveAccountsLoading && driveAccounts.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <RefreshCw size={16} className="animate-spin" /> Loading drives…
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {displayedDriveAccounts.map(account => {
                  const usagePct = account.storage?.usage_pct || 0;
                  return (
                    <div
                      key={account.id}
                      style={{
                        padding: '16px', background: account.is_default ? 'rgba(99, 102, 241, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                         
                        border: account.is_default ? '1.5px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px',
                        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.12)'
                      }}
                    >
                      {/* Account info */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {account.avatar_url ? (
                          <img src={account.avatar_url} alt="" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '14px', flexShrink: 0 }}>
                            {userInitials(account.display_name || account.account_email)}
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={account.account_email}>
                              {account.account_email}
                            </span>
                          </div>
                          {account.is_default && (
                            <span style={{ display: 'inline-block', background: '#6366f1', color: 'white', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', marginTop: '4px' }}>
                              Primary Default
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Individual Storage Filled Percentage Line Bar */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
                          <span>{fmtBytes(account.storage.used_bytes)} / {account.storage.limit_bytes ? fmtBytes(account.storage.limit_bytes) : '∞'}</span>
                          <span style={{ fontWeight: 700, color: usagePct > 85 ? '#fca5a5' : '#38bdf8' }}>{usagePct}%</span>
                        </div>
                        <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(usagePct, 100)}%`, background: usagePct > 85 ? '#ef4444' : '#6366f1', borderRadius: '3px', transition: 'width 0.3s ease' }} />
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                        {!account.is_default && (
                          <button
                            onClick={() => handleSetDefaultDrive(account.id)}
                            style={{ flex: 1, background: 'rgba(255, 255, 255, 0.06)',  border: '1px solid rgba(255, 255, 255, 0.12)', color: '#f8fafc', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                          >
                            Set Default
                          </button>
                        )}
                        <button
                          onClick={() => handleDisconnectDrive(account)}
                          style={{ flex: account.is_default ? 1 : 'none', background: 'rgba(239, 68, 68, 0.15)',  border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          Disconnect
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Read More / View All Toggle for Connected Drives */}
                {(hasMoreDrives || showAllDrives) && (
                  <div style={{ marginTop: '8px', textAlign: 'center' }}>
                    <button
                      onClick={() => setShowAllDrives(prev => !prev)}
                      style={{
                        background: 'rgba(99, 102, 241, 0.18)',
                        border: '1px solid rgba(165, 180, 252, 0.35)',
                        color: '#a5b4fc',
                        borderRadius: '8px',
                        padding: '8px 16px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        width: '100%',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.3)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.18)'}
                    >
                      {showAllDrives ? 'Show Less' : `View All (${driveAccounts.length} drives)`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </aside>

          {/* ─── RIGHT COLUMN: Upload Hero Dropzone & Recent Files Table ───────── */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

            {/* ─── Destination Options & Multi-File Hero Drop Zone ─────────────── */}
            <div className="paper-card" style={{ padding: '28px' }}>

              {/* Destination picker */}
              <p style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Target Destination for New Files</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
                {[
                  { value: 'permanent', label: 'Permanent Storage',  sub: 'Google Drive Space', icon: <Cloud  size={20} color={uploadIntent === 'permanent'  ? '#FFFFFF' : '#94a3b8'} /> },
                  { value: 'temporary', label: 'Temporary Share',    sub: 'Cloudflare R2 · Auto-deletes', icon: <Clock size={20} color={uploadIntent === 'temporary'  ? '#FFFFFF' : '#94a3b8'} /> },
                ].map(({ value, label, sub, icon }) => (
                  <button
                    key={value}
                    id={`dest-${value}`}
                    onClick={() => setUploadIntent(value)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '14px', height: '64px',
                      padding: '12px 18px', borderRadius: '12px', textAlign: 'left',
                      border:      uploadIntent === value ? '1.5px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.12)',
                      background:  uploadIntent === value ? 'rgba(99, 102, 241, 0.22)' : 'rgba(255, 255, 255, 0.03)',
                      color:       uploadIntent === value ? '#FFFFFF' : '#f8fafc',
                      cursor: 'pointer', transition: 'all 0.2s ease', fontFamily: 'inherit',
                      boxSizing: 'border-box', boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                    }}
                  >
                    <div style={{ flexShrink: 0 }}>{icon}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: uploadIntent === value ? '#FFFFFF' : '#f8fafc', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</p>
                      <p style={{ fontSize: '12px', color: uploadIntent === value ? '#FFFFFF' : '#94a3b8', opacity: uploadIntent === value ? 0.85 : 1, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Target Google Drive Account Selector (Permanent only) */}
              {uploadIntent === 'permanent' && driveAccounts.length > 0 && (
                <div style={{ marginBottom: '24px', background: 'rgba(255, 255, 255, 0.03)',  border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '16px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc', display: 'block', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Select Target Google Drive:
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {driveAccounts.map(account => (
                      <label
                        key={account.id}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '46px',
                          padding: '0 14px', borderRadius: '8px', background: 'rgba(15, 25, 48, 0.5)',
                           
                          border: selectedDriveAccountId === account.id ? '1.5px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.12)',
                          cursor: 'pointer', transition: 'all 0.2s ease', boxSizing: 'border-box'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                          <input
                            type="radio"
                            name="drive_account_choice"
                            value={account.id}
                            checked={selectedDriveAccountId === account.id}
                            onChange={() => setSelectedDriveAccountId(account.id)}
                            style={{ accentColor: '#6366f1', flexShrink: 0 }}
                          />
                          <span style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{account.account_email}</span>
                          {account.is_default && (
                            <span style={{ background: 'rgba(99, 102, 241, 0.25)', color: '#38bdf8', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', flexShrink: 0 }}>
                              Default
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '12px', color: '#94a3b8', flexShrink: 0, marginLeft: '12px' }}>
                          {account.storage?.usage_pct || 0}% filled
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Expiry picker (Temporary only) - Glassmorphic Dropdown */}
              {uploadIntent === 'temporary' && (
                <div style={{ marginBottom: '24px', position: 'relative' }}>
                  <label htmlFor="expiry-select" style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Auto-Deletion Period</label>
                  
                  {/* Glass Trigger Button */}
                  <div
                    onClick={() => setIsExpiryDropdownOpen(prev => !prev)}
                    style={{
                      ...S.input,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      userSelect: 'none',
                      background: 'rgba(15, 25, 48, 0.45)',
                      border: isExpiryDropdownOpen ? '1px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.16)',
                      boxShadow: isExpiryDropdownOpen ? '0 0 15px rgba(99, 102, 241, 0.3)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Clock size={16} color="#38bdf8" />
                      <span style={{ fontWeight: 600, color: '#f8fafc' }}>
                        {expiresHours === '1' && '1 hour (60 minutes)'}
                        {expiresHours === '24' && '24 hours (1 day)'}
                        {expiresHours === '168' && '7 days (1 week)'}
                      </span>
                    </div>
                    <ChevronDown size={16} color="#a5b4fc" style={{ transform: isExpiryDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
                  </div>

                  {/* Hidden select for accessibility & test bindings */}
                  <select
                    id="expiry-select"
                    value={expiresHours}
                    onChange={e => setExpiresHours(e.target.value)}
                    style={{ display: 'none' }}
                  >
                    <option value="1">1 hour</option>
                    <option value="24">24 hours</option>
                    <option value="168">7 days</option>
                  </select>

                  {/* Floating Glassmorphic Dropdown Card Menu */}
                  {isExpiryDropdownOpen && (
                    <>
                      {/* Invisible backdrop to dismiss on click outside */}
                      <div
                        style={{ position: 'fixed', inset: 0, zIndex: 90 }}
                        onClick={() => setIsExpiryDropdownOpen(false)}
                      />
                      <div
                        className="paper-card"
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          marginTop: '6px',
                          zIndex: 100,
                          padding: '6px',
                          background: 'rgba(15, 25, 48, 0.85)',
                          backdropFilter: 'blur(24px) saturate(190%)',
                          WebkitBackdropFilter: 'blur(24px) saturate(190%)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
                          borderRadius: '12px',
                        }}
                      >
                        {[
                          { value: '1', label: '1 hour', desc: 'Auto-deletes in 60 minutes' },
                          { value: '24', label: '24 hours', desc: 'Auto-deletes tomorrow' },
                          { value: '168', label: '7 days', desc: 'Auto-deletes in 1 week' },
                        ].map((opt) => {
                          const isSelected = expiresHours === opt.value;
                          return (
                            <div
                              key={opt.value}
                              onClick={() => {
                                setExpiresHours(opt.value);
                                setIsExpiryDropdownOpen(false);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px 14px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                background: isSelected ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                                color: isSelected ? '#FFFFFF' : '#f8fafc',
                                border: isSelected ? '1px solid rgba(165, 180, 252, 0.3)' : '1px solid transparent',
                              }}
                              onMouseEnter={e => {
                                if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                              }}
                              onMouseLeave={e => {
                                if (!isSelected) e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              <div>
                                <p style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{opt.label}</p>
                                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0 0' }}>{opt.desc}</p>
                              </div>
                              {isSelected && <Check size={16} color="#38bdf8" />}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
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
                <div style={{ width: '56px', height: '56px', background: 'rgba(99, 102, 241, 0.25)',  border: '1px solid rgba(165, 180, 252, 0.35)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
                  <Upload size={26} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontWeight: 700, fontSize: '18px', color: '#f8fafc', margin: '0 0 4px' }}>Drop files to upload to space</p>
                  <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0 }}>or click to browse multiple files from your computer</p>
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
              <div className="paper-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Upload size={20} color="#38bdf8" />
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>Space Upload Queue</h3>
                    <span style={{ background: 'rgba(99, 102, 241, 0.22)',  color: '#38bdf8', fontSize: '12px', fontWeight: 700, padding: '3px 10px', borderRadius: '9999px', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
                      {completedCount} / {totalQueueCount} completed {uploadingCount > 0 ? `(${uploadingCount} active)` : ''}
                    </span>
                  </div>

                  {/* Speed & Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>

                    {/* Concurrency Selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255, 255, 255, 0.04)',  border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '8px', padding: '3px 4px' }}>
                      <Zap size={14} color="#38bdf8" style={{ marginLeft: '6px' }} />
                      {[
                        { level: 1, label: '1x' },
                        { level: 3, label: '3x Parallel' },
                        { level: 5, label: '5x Turbo' },
                      ].map(({ level, label }) => (
                        <button
                          key={level}
                          onClick={() => setMaxConcurrency(level)}
                          style={{
                            padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                            border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s ease',
                            background: maxConcurrency === level ? 'rgba(99, 102, 241, 0.22)' : 'transparent',
                            color:      maxConcurrency === level ? '#FFFFFF' : '#94a3b8',
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {uploadQueue.some(i => i.status === 'completed' || i.status === 'cancelled') && (
                      <button
                        onClick={clearCompletedQueue}
                        style={{ background: 'rgba(255, 255, 255, 0.06)',  border: '1px solid rgba(255, 255, 255, 0.12)', color: '#f8fafc', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        Clear Finished
                      </button>
                    )}
                    {uploadQueue.some(i => i.status === 'error' || i.status === 'cancelled') && (
                      <button
                        onClick={retryFailedQueue}
                        style={{ background: 'rgba(99, 102, 241, 0.22)',  border: '1px solid rgba(99, 102, 241, 0.35)', color: '#38bdf8', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        Retry Failed
                      </button>
                    )}
                  </div>
                </div>

                {/* Overall Queue Progress Bar */}
                <div style={{ marginBottom: '20px', background: 'rgba(255, 255, 255, 0.03)',  border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '14px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}>
                    <span>Overall Progress ({maxConcurrency}x parallel threads)</span>
                    <span style={{ color: '#f8fafc', fontWeight: 700 }}>{fmtBytes(loadedQueueBytes)} / {fmtBytes(totalQueueBytes)} ({overallQueuePct}%)</span>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${overallQueuePct}%`, background: 'linear-gradient(90deg, #6366f1, #38bdf8)', borderRadius: '4px', transition: 'width 0.2s ease' }} />
                  </div>
                </div>

                {/* Queue Items List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {uploadQueue.map(item => (
                    <div
                      key={item.id}
                      style={{
                        padding: '14px 18px', background: item.status === 'uploading' ? 'rgba(99, 102, 241, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                         
                        border: item.status === 'uploading' ? '1.5px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                          <FileIcon size={18} color="#f8fafc" style={{ flexShrink: 0 }} />
                          <span style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.file.name}
                          </span>
                          <span style={{ fontSize: '12px', color: '#94a3b8', flexShrink: 0 }}>
                            ({fmtBytes(item.file.size)})
                          </span>
                        </div>

                        {/* Status Badges & Controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                          {item.status === 'pending' && (
                            <span style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#94a3b8', fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '9999px' }}>
                              Pending
                            </span>
                          )}
                          {item.status === 'uploading' && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#6366f1', color: 'white', fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '9999px' }}>
                              <RefreshCw size={12} className="animate-spin" /> {item.progressPct}%
                            </span>
                          )}
                          {item.status === 'completed' && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7', fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '9999px' }}>
                              <Check size={13} /> Completed
                            </span>
                          )}
                          {item.status === 'cancelled' && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(255, 255, 255, 0.1)', color: '#94a3b8', fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '9999px' }}>
                              Cancelled
                            </span>
                          )}
                          {item.status === 'error' && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '9999px' }}>
                              <AlertCircle size={13} /> Failed
                            </span>
                          )}

                          {/* Cancel / Remove Cross Icon */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              cancelOrRemoveQueueItem(item.id);
                            }}
                            style={{ background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '6px', cursor: 'pointer', padding: '5px', color: item.status === 'uploading' ? '#fca5a5' : '#94a3b8', transition: 'all 0.15s ease' }}
                            title={item.status === 'uploading' ? 'Cancel active upload' : 'Remove from queue'}
                          >
                            <X size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Per-item progress bar when uploading */}
                      {item.status === 'uploading' && (
                        <div>
                          <div style={{ height: '4px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${item.progressPct}%`, background: 'linear-gradient(90deg, #6366f1, #38bdf8)', borderRadius: '2px', transition: 'width 0.15s linear' }} />
                          </div>
                        </div>
                      )}

                      {/* Error message detail */}
                      {item.status === 'error' && item.errorMsg && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <p style={{ fontSize: '12px', color: '#fca5a5', margin: 0 }}>
                            {item.errorMsg}
                          </p>
                          {(item.errorMsg.includes('invalid_grant') || item.errorMsg.includes('expired') || item.errorMsg.includes('revoked') || item.errorMsg.includes('Google Drive client')) && (
                            <button
                              onClick={() => { window.location.href = '/api/v1/auth/google/connect'; }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: 'rgba(99, 102, 241, 0.25)',
                                border: '1px solid rgba(165, 180, 252, 0.4)',
                                color: '#38bdf8',
                                borderRadius: '6px',
                                padding: '6px 14px',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                width: 'fit-content',
                                marginTop: '4px',
                                transition: 'all 0.2s ease',
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.4)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.25)'}
                            >
                              <Plus size={14} /> Re-connect Google Drive Account ({item.accountEmail || 'shubhang.dev01@gmail.com'})
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Files Section: Tabs + Search + File Table ──────────────────── */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginBottom: '16px' }}>
                {/* Tab bar */}
                <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.04)',   border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '10px', padding: '4px', gap: '4px', height: '44px', boxSizing: 'border-box', alignItems: 'center' }}>
                  {[
                    { value: 'permanent', label: 'Google Drive Files' },
                    { value: 'temporary', label: 'Cloudflare R2 Shares' },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      id={`tab-${value}`}
                      onClick={() => setActiveTab(value)}
                      style={{
                        padding: '6px 18px', borderRadius: '6px', fontSize: '14px', fontWeight: 600, height: '34px',
                        border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s ease',
                        background: activeTab === value ? 'rgba(99, 102, 241, 0.22)' : 'transparent',
                        color:      activeTab === value ? '#FFFFFF' : '#94a3b8',
                        boxShadow:  activeTab === value ? '0 0 15px rgba(99, 102, 241, 0.25)' : 'none',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Search */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search size={16} style={{ position: 'absolute', left: '14px', color: '#94a3b8', pointerEvents: 'none' }} />
                  <input
                    id="search-files"
                    type="search"
                    placeholder="Search files by name…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ ...S.input, paddingLeft: '38px', width: '240px', height: '44px' }}
                  />
                </div>
              </div>

              {/* Table Container */}
              <div className="paper-card" style={{ overflow: 'hidden' }}>

                {/* Table Header Bar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid rgba(255, 255, 255, 0.12)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>
                      {activeTab === 'permanent' ? 'Google Drive Files' : 'Cloudflare R2 Files'}
                    </span>
                    <span style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#38bdf8', fontSize: '12px', fontWeight: 700, padding: '2px 10px', borderRadius: '9999px', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
                      {filteredFiles.length}
                    </span>
                  </div>
                  <button
                    onClick={fetchFiles}
                    title="Refresh list"
                    style={S.btnIcon}
                  >
                    <RefreshCw size={15} />
                  </button>
                </div>

                {/* Empty state */}
                {filteredFiles.length === 0 ? (
                  <div style={{ padding: '64px 24px', textAlign: 'center' }}>
                    <div style={{ width: '56px', height: '56px', background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#f8fafc' }}>
                      {activeTab === 'permanent'
                        ? <Cloud size={26} />
                        : <Clock size={26} />}
                    </div>
                    <p style={{ fontSize: '16px', fontWeight: 600, color: '#f8fafc', margin: '0 0 6px' }}>
                      {searchQuery ? 'No matching files found' : `No ${activeTab} files yet`}
                    </p>
                    {!searchQuery && (
                      <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0 }}>
                        Drop files above to store them in your space workspace.
                      </p>
                    )}
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', minWidth: '640px', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)', background: 'rgba(255, 255, 255, 0.06)' }}>
                          <th style={{ width: activeTab === 'permanent' ? '35%' : '42%', padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.04em' }}>File Name</th>
                          {activeTab === 'permanent' && (
                            <th style={{ width: '25%', padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Target Drive</th>
                          )}
                          <th style={{ width: '18%', padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Uploaded</th>
                          <th style={{ width: '12%', padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Size</th>
                          {activeTab === 'temporary' && (
                            <th style={{ width: '15%', padding: '12px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Expires</th>
                          )}
                          <th style={{ width: '10%', padding: '12px 24px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedFiles.map((f, idx) => {
                          const expiry = fmtExpiry(f.expires_at);
                          const isExpiringSoon = expiry && expiry.includes('m left');
                          return (
                            <tr
                              key={f.id}
                              style={{ borderBottom: idx < displayedFiles.length - 1 ? '1px solid rgba(255, 255, 255, 0.12)' : 'none', transition: 'background 0.2s ease' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              {/* Name */}
                              <td style={{ padding: '14px 24px', verticalAlign: 'middle' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                                  <div style={{ width: '36px', height: '36px', background: 'rgba(255, 255, 255, 0.05)',  border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#38bdf8' }}>
                                    <FileIcon size={16} />
                                  </div>
                                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.filename}>
                                    {f.filename}
                                  </span>
                                </div>
                              </td>

                              {/* Target Drive (permanent only) */}
                              {activeTab === 'permanent' && (
                                <td style={{ padding: '14px 24px', fontSize: '14px', color: '#38bdf8', fontWeight: 600, verticalAlign: 'middle', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {f.drive_account_email || 'Google Drive'}
                                </td>
                              )}

                              {/* Uploaded */}
                              <td style={{ padding: '14px 24px', fontSize: '14px', color: '#94a3b8', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>{fmtDate(f.created_at)}</td>

                              {/* Size */}
                              <td style={{ padding: '14px 24px', fontSize: '14px', color: '#94a3b8', fontWeight: 500, verticalAlign: 'middle', whiteSpace: 'nowrap' }}>{fmtBytes(f.size_bytes)}</td>

                              {/* Expires (temporary only) */}
                              {activeTab === 'temporary' && (
                                <td style={{ padding: '14px 24px', fontSize: '14px', fontWeight: isExpiringSoon ? 700 : 500, color: isExpiringSoon ? '#fca5a5' : '#94a3b8', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                                  {expiry ? (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: isExpiringSoon ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.06)', padding: '2px 8px', borderRadius: '6px' }}>
                                      <Clock size={12} /> {expiry}
                                    </span>
                                  ) : '—'}
                                </td>
                              )}

                              {/* Actions */}
                              <td style={{ padding: '14px 24px', textAlign: 'right', verticalAlign: 'middle' }}>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      handleDownload(f);
                                    }}
                                    title="Download"
                                    style={S.btnIcon}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'}
                                  >
                                    <Download size={15} />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      handleDelete(f);
                                    }}
                                    title="Delete"
                                    style={{ ...S.btnIcon, color: '#fca5a5' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'}
                                  >
                                    <Trash2 size={15} />
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

                {/* Read More / View All Toggle Footer */}
                {(hasMoreFiles || showAllFiles) && (
                  <div style={{ padding: '14px 24px', textAlign: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.12)', background: 'rgba(255, 255, 255, 0.02)' }}>
                    <button
                      onClick={() => setShowAllFiles(prev => !prev)}
                      style={{
                        background: 'rgba(99, 102, 241, 0.18)',
                        border: '1px solid rgba(165, 180, 252, 0.35)',
                        color: '#a5b4fc',
                        borderRadius: '8px',
                        padding: '8px 20px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.3)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.18)'}
                    >
                      {showAllFiles ? 'Show Less' : `View All (${filteredFiles.length} files)`}
                    </button>
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
