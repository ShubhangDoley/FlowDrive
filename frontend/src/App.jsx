import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Cloud, LogOut, Upload, File as FileIcon,
  Download, Trash2, Clock, RefreshCw, Search, X, Plus, HardDrive, Check, AlertCircle,
  Zap, Orbit, Star
} from 'lucide-react';
import { Toaster, toast } from 'sonner';

const GithubIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ display: 'block' }}>
    <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
  </svg>
);


import { Button }                                                    from '@/components/ui/button';
import { Input }                                                     from '@/components/ui/input';
import { Label }                                                     from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent }                  from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle,
         DialogDescription, DialogFooter }                           from '@/components/ui/dialog';
import { Alert, AlertTitle, AlertDescription }                       from '@/components/ui/alert';
import { Badge }                                                      from '@/components/ui/badge';
import { Progress }                                                   from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback }                                    from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// ─── API helper ───────────────────────────────────────────────────────────────
const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'https://flowdrive-backend-2.onrender.com').replace(/\/$/, '');
const getUrl = (path) => path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;

const API = {
  get:      (path)           => fetch(getUrl(path), { credentials: 'include' }),
  post:     (path, body)     => fetch(getUrl(path), { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  postForm: (path, formData) => fetch(getUrl(path), { method: 'POST', credentials: 'include', body: formData }),
  postFormWithProgress: (path, formData, onProgress, onRegisterAbort) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', getUrl(path));
      xhr.withCredentials = true;
      if (onRegisterAbort) onRegisterAbort(() => xhr.abort());
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
        resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, json: async () => json });
      };
      xhr.onerror = () => reject(new TypeError('Network request failed'));
      xhr.onabort = () => reject(new Error('Upload cancelled by user'));
      xhr.send(formData);
    });
  },
  patch:    (path, body)     => fetch(getUrl(path), { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  delete:   (path)           => fetch(getUrl(path), { method: 'DELETE', credentials: 'include' }),
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
  if (diff < 86400000)  return 'Today';
  if (diff < 172800000) return 'Yesterday';
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

// ─── Status badge map ──────────────────────────────────────────────────────────
function QueueStatusBadge({ status }) {
  const map = {
    pending:   { label: 'Queued',     className: 'bg-yellow-300 border-black text-black' },
    uploading: { label: 'Uploading',  className: 'bg-blue-400 border-black text-black'  },
    completed: { label: 'Done',       className: 'bg-green-400 border-black text-black' },
    error:     { label: 'Error',      className: 'bg-red-400 border-black text-black'   },
    cancelled: { label: 'Cancelled',  className: 'bg-gray-300 border-black text-black'  },
  };
  const { label, className } = map[status] || { label: status, className: '' };
  return <Badge className={`text-xs font-bold ${className}`}>{label}</Badge>;
}

// ─── Demo Mode Seed Data ──────────────────────────────────────────────────────
const DEMO_USER = {
  id: 'demo-user-id',
  username: 'demo_user',
  email: 'demo@flowdrive.io',
  display_name: 'Demo Visitor',
  is_demo: true,
  has_drive_connected: true,
};

const DEMO_DRIVE_ACCOUNTS = [
  {
    id: 'demo-drive-1',
    account_email: 'work.drive@gmail.com',
    is_default: true,
    storage: { used_bytes: 8589934592, limit_bytes: 16106127360, usage_pct: 53.3 },
  },
  {
    id: 'demo-drive-2',
    account_email: 'personal.drive@gmail.com',
    is_default: false,
    storage: { used_bytes: 4294967296, limit_bytes: 16106127360, usage_pct: 26.7 },
  },
];

const DEMO_FILES = [
  {
    id: 'demo-f-1',
    filename: 'Q3_Financial_Report.pdf',
    provider: 'google_drive',
    drive_account_email: 'work.drive@gmail.com',
    created_at: new Date().toISOString(),
    size_bytes: 4521984,
  },
  {
    id: 'demo-f-2',
    filename: 'FlowDrive_Architecture_Diagram.png',
    provider: 'google_drive',
    drive_account_email: 'work.drive@gmail.com',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    size_bytes: 2840576,
  },
  {
    id: 'demo-f-3',
    filename: 'Project_Backup_2026.zip',
    provider: 'google_drive',
    drive_account_email: 'personal.drive@gmail.com',
    created_at: new Date(Date.now() - 172800000).toISOString(),
    size_bytes: 104857600,
  },
  {
    id: 'demo-f-4',
    filename: 'Temporary_Share_Asset.mp4',
    provider: 'cloudflare_r2',
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 3600000 * 18).toISOString(),
    size_bytes: 52428800,
  },
  {
    id: 'demo-f-5',
    filename: 'Temporary_Design_Mockups.fig',
    provider: 'cloudflare_r2',
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 3600000 * 2).toISOString(),
    size_bytes: 12582912,
  },
];

// ─── App root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [authState, setAuthState] = useState('loading');
  const [user,      setUser]      = useState(null);
  const [isDemo,    setIsDemo]    = useState(false);

  // Auth form state
  const [siUser,     setSiUser]     = useState('');
  const [siPass,     setSiPass]     = useState('');
  const [suUsername, setSuUsername] = useState('');
  const [suPass,     setSuPass]     = useState('');
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(false);

  // Dashboard state
  const [files,        setFiles]        = useState([]);
  const [activeTab,    setActiveTab]    = useState('permanent');
  const [searchQuery,  setSearchQuery]  = useState('');
  const [showAllFiles, setShowAllFiles] = useState(false);
  useEffect(() => { setShowAllFiles(false); }, [activeTab, searchQuery]);

  // Multi-Drive state
  const [driveAccounts,          setDriveAccounts]          = useState([]);
  const [driveAccountsLoading,   setDriveAccountsLoading]   = useState(false);
  const [selectedDriveAccountId, setSelectedDriveAccountId] = useState(null);
  const [driveError,             setDriveError]             = useState(null);
  const [showAllDrives,          setShowAllDrives]          = useState(false);

  function enterDemoMode() {
    setIsDemo(true);
    setUser(DEMO_USER);
    setDriveAccounts(DEMO_DRIVE_ACCOUNTS);
    setSelectedDriveAccountId('demo-drive-1');
    setFiles(DEMO_FILES);
    setAuthState('authenticated');
    toast.success('Welcome to FlowDrive Demo Mode!');
  }

  // Upload state
  const [uploadIntent,   setUploadIntent]   = useState('permanent');
  const [expiresHours,   setExpiresHours]   = useState('24');
  const [isDragging,     setIsDragging]     = useState(false);

  // Upload queue & concurrency
  const [uploadQueue,       setUploadQueue]       = useState([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [maxConcurrency,    setMaxConcurrency]    = useState(3);

  // Confirm modal
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', confirmText: 'Delete', danger: true, onConfirm: null });

  const fileInputRef    = useRef(null);
  const activeAbortsRef = useRef({});
  const uploadQueueRef  = useRef([]);

  const updateQueue = useCallback((updater) => {
    const next = typeof updater === 'function' ? updater(uploadQueueRef.current) : updater;
    uploadQueueRef.current = next;
    setUploadQueue(next);
  }, []);

  function promptConfirm({ title, message, confirmText = 'Delete', danger = true, onConfirm }) {
    setConfirmModal({ isOpen: true, title, message, confirmText, danger, onConfirm: async () => {
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
      if (onConfirm) await onConfirm();
    }});
  }

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
      .catch(() => { setAuthState('unauthenticated'); });
  }, []);

  const fetchFiles = useCallback(async () => {
    if (isDemo || authState !== 'authenticated') return;
    try {
      const res = await API.get('/api/v1/files');
      if (res.ok) { const data = await res.json(); setFiles(data.files ?? []); }
    } catch (e) { console.error('Failed to fetch files', e); }
  }, [authState, isDemo]);

  const fetchDriveAccounts = useCallback(async () => {
    if (isDemo || authState !== 'authenticated') return;
    setDriveAccountsLoading(true); setDriveError(null);
    try {
      const res = await API.get('/api/v1/drive/accounts');
      if (res.ok) {
        const data = await res.json();
        const accounts = data.accounts ?? [];
        setDriveAccounts(accounts);
        const def = accounts.find(a => a.is_default) ?? accounts[0];
        if (def) setSelectedDriveAccountId(def.id);
      }
    } catch (e) { console.error('Failed to fetch drive accounts', e); }
    finally { setDriveAccountsLoading(false); }
  }, [authState, isDemo]);

  useEffect(() => {
    if (authState === 'authenticated') { fetchFiles(); fetchDriveAccounts(); }
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
          if (targetItem.intent === 'permanent' && targetItem.driveAccountId) form.append('drive_account_id', targetItem.driveAccountId);
          if (targetItem.intent === 'temporary') form.append('expiry_hours', targetItem.expiresHours);
          const res = await API.postFormWithProgress(
            '/api/v1/files', form,
            (pct, loaded, total) => {
              const idx = uploadQueueRef.current.findIndex(i => i.id === targetItem.id);
              if (idx !== -1) { const next = [...uploadQueueRef.current]; next[idx] = { ...next[idx], progressPct: pct, loaded, total }; updateQueue(next); }
            },
            (abortFn) => { activeAbortsRef.current[targetItem.id] = abortFn; }
          );
          delete activeAbortsRef.current[targetItem.id];
          if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.detail ?? `Upload failed (${res.status})`); }
          const idx = uploadQueueRef.current.findIndex(i => i.id === targetItem.id);
          if (idx !== -1) { const next = [...uploadQueueRef.current]; next[idx] = { ...next[idx], status: 'completed', progressPct: 100 }; updateQueue(next); }
          fetchFiles(); fetchDriveAccounts();
          toast.success(`${targetItem.file.name} uploaded successfully`);
        } catch (err) {
          delete activeAbortsRef.current[targetItem.id];
          const isCancelled = err.message?.includes('cancelled');
          const idx = uploadQueueRef.current.findIndex(i => i.id === targetItem.id);
          if (idx !== -1) { const next = [...uploadQueueRef.current]; next[idx] = { ...next[idx], status: isCancelled ? 'cancelled' : 'error', errorMsg: isCancelled ? null : err.message }; updateQueue(next); }
          if (!isCancelled) toast.error(err.message ?? 'Upload failed');
        }
      }
    };
    const workers = Array.from({ length: maxConcurrency }, () => runWorker());
    await Promise.all(workers);
    setIsProcessingQueue(false);
  }, [isProcessingQueue, maxConcurrency, fetchFiles, fetchDriveAccounts, updateQueue]);

  useEffect(() => {
    const hasPending = uploadQueue.some(item => item.status === 'pending');
    if (hasPending && !isProcessingQueue) processQueue();
  }, [uploadQueue, isProcessingQueue, processQueue]);

  function addFilesToQueue(fileList) {
    if (!fileList || fileList.length === 0) return;
    const newItems = Array.from(fileList).map((file, idx) => ({
      id: `q-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
      file, intent: uploadIntent,
      driveAccountId: uploadIntent === 'permanent' ? selectedDriveAccountId : null,
      expiresHours, status: 'pending', progressPct: 0, loaded: 0, total: file.size, errorMsg: null,
    }));
    updateQueue(prev => [...prev, ...newItems]);
  }

  function cancelOrRemoveQueueItem(itemId) {
    if (activeAbortsRef.current[itemId]) { try { activeAbortsRef.current[itemId](); } catch (e) {} delete activeAbortsRef.current[itemId]; }
    updateQueue(prev => prev.filter(item => item.id !== itemId));
  }
  function clearCompletedQueue() { updateQueue(prev => prev.filter(item => item.status !== 'completed' && item.status !== 'cancelled')); }
  function retryFailedQueue() { updateQueue(prev => prev.map(item => (item.status === 'error' || item.status === 'cancelled') ? { ...item, status: 'pending', errorMsg: null, progressPct: 0 } : item)); }

  // Aggregate storage calculations
  const totalUsedBytes  = driveAccounts.reduce((acc, a) => acc + (a.storage?.used_bytes  || 0), 0);
  const totalLimitBytes = driveAccounts.reduce((acc, a) => acc + (a.storage?.limit_bytes || 0), 0);
  const totalUsagePct   = totalLimitBytes > 0 ? Math.min(Math.round((totalUsedBytes / totalLimitBytes) * 100), 100) : 0;

  // Queue aggregates
  const completedCount  = uploadQueue.filter(i => i.status === 'completed').length;
  const uploadingCount  = uploadQueue.filter(i => i.status === 'uploading').length;
  const totalQueueCount = uploadQueue.length;
  const totalQueueBytes = uploadQueue.reduce((acc, i) => acc + i.total, 0);
  const loadedQueueBytes= uploadQueue.reduce((acc, i) => acc + (i.status === 'completed' ? i.total : (i.loaded || 0)), 0);
  const overallQueuePct = totalQueueBytes > 0 ? Math.min(Math.round((loadedQueueBytes / totalQueueBytes) * 100), 100) : 0;

  // ─── Handlers ─────────────────────────────────────────────────────────────
  async function handleSignIn(e) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res  = await API.post('/api/v1/auth/login', { username: siUser, password: siPass });
      const data = await res.json();
      if (!res.ok) { setError(data.detail ?? 'Login failed.'); return; }
      onAuth(data);
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  }

  async function handleSignUp(e) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res  = await API.post('/api/v1/auth/register', { username: suUsername, password: suPass });
      const data = await res.json();
      if (!res.ok) { setError(data.detail ?? 'Registration failed.'); return; }
      onAuth(data);
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  }

  function handleLogout() {
    promptConfirm({
      title: 'Log Out', message: 'Are you sure you want to log out of FlowDrive?',
      confirmText: 'Log Out', danger: true,
      onConfirm: async () => {
        if (isDemo) {
          setIsDemo(false);
          setAuthState('unauthenticated');
          setUser(null);
          toast.success('Exited Demo Mode');
          return;
        }
        try { await API.post('/api/v1/auth/logout', {}); setAuthState('unauthenticated'); setUser(null); toast.success('Logged out successfully'); }
        catch (e) { toast.error('Failed to log out. Please try again.'); }
      }
    });
  }

  function handleDelete(file) {
    if (!file || !file.id) return;
    const isDrive = file.provider === 'google_drive';
    promptConfirm({
      title: 'Delete File',
      message: `Delete "${file.filename}" from ${isDrive ? 'Google Drive' : 'temporary storage'}? This cannot be undone.`,
      confirmText: 'Delete File', danger: true,
      onConfirm: async () => {
        if (isDemo) {
          setFiles(prev => prev.filter(f => f.id !== file.id));
          toast.success(`"${file.filename}" deleted (demo mode)`);
          return;
        }
        try {
          const res = await API.delete(`/api/v1/files/${file.id}`);
          if (res.ok || res.status === 204) {
            setFiles(prev => prev.filter(f => f.id !== file.id));
            toast.success(`"${file.filename}" deleted`);
            fetchFiles(); fetchDriveAccounts();
          } else {
            const errData = await res.json().catch(() => ({}));
            toast.error(`Delete failed: ${errData.detail || 'Server error'}`);
          }
        } catch { toast.error('Delete failed due to network error.'); }
      }
    });
  }

  function handleDownload(file) {
    if (!file || !file.id) return;
    if (isDemo) {
      toast.info(`Simulated download for "${file.filename}" (demo mode)`);
      return;
    }
    window.open(getUrl(`/api/v1/files/${file.id}/download`), '_blank');
  }

  async function handleSetDefaultDrive(accountId) {
    if (isDemo) {
      setDriveAccounts(prev => prev.map(a => ({ ...a, is_default: a.id === accountId })));
      setSelectedDriveAccountId(accountId);
      toast.success('Default Google Drive updated (demo mode)');
      return;
    }
    setDriveError(null);
    try {
      const res = await API.patch(`/api/v1/drive/accounts/${accountId}/default`, {});
      if (res.ok) { toast.success('Default Google Drive updated'); fetchDriveAccounts(); }
      else { const data = await res.json().catch(() => ({})); toast.error(data.detail ?? 'Failed to set default Drive'); }
    } catch { toast.error('Failed to update default Drive'); }
  }

  function handleDisconnectDrive(account) {
    promptConfirm({
      title: 'Disconnect Drive', message: `Disconnect Google account (${account.account_email})?`,
      confirmText: 'Disconnect', danger: true,
      onConfirm: async () => {
        if (isDemo) {
          setDriveAccounts(prev => prev.filter(a => a.id !== account.id));
          toast.success(`Disconnected ${account.account_email} (demo mode)`);
          return;
        }
        try {
          const res = await API.delete(`/api/v1/drive/accounts/${account.id}`);
          if (res.ok) { toast.success(`Disconnected ${account.account_email}`); fetchDriveAccounts(); }
          else { const data = await res.json().catch(() => ({})); toast.error(data.detail ?? 'Failed to disconnect'); }
        } catch { toast.error('Failed to disconnect Drive account.'); }
      }
    });
  }

  async function handleGoogleConnect() {
    if (isDemo) {
      toast.info('You are in Demo Mode! Sign out and log in with a real account to connect Google Drive.');
      return;
    }
    try {
      const res = await API.get('/api/v1/auth/google/connect-url');
      if (res.ok) { const data = await res.json(); if (data?.url) { window.location.href = data.url; return; } }
      window.location.href = getUrl('/api/v1/auth/google/connect');
    } catch { window.location.href = getUrl('/api/v1/auth/google/connect'); }
  }

  // Filtered files
  const filteredFiles  = files.filter(f => {
    const typeMatch = activeTab === 'permanent' ? f.provider === 'google_drive' : f.provider !== 'google_drive';
    const nameMatch = !searchQuery || f.filename?.toLowerCase().includes(searchQuery.toLowerCase());
    return typeMatch && nameMatch;
  });
  const FILE_PAGE      = 8;
  const displayedFiles = showAllFiles ? filteredFiles : filteredFiles.slice(0, FILE_PAGE);
  const hasMoreFiles   = filteredFiles.length > FILE_PAGE;

  const DRIVE_PAGE      = 4;
  const displayedDrives = showAllDrives ? driveAccounts : driveAccounts.slice(0, DRIVE_PAGE);
  const hasMoreDrives   = driveAccounts.length > DRIVE_PAGE;
  const dropZoneClass   = `drop-zone${isDragging ? ' drag-over' : ''}`;

  // ─── Loading screen ───────────────────────────────────────────────────────
  if (authState === 'loading') {
    return (
      <div className="neo-bg flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="w-16 h-16 rounded-base border-4 border-black bg-main flex items-center justify-center shadow-shadow">
          <Orbit size={32} />
        </div>
        <div className="flex items-center gap-3 text-base font-bold">
          <RefreshCw size={18} className="animate-spin" />
          <span>Loading FlowDrive…</span>
        </div>
        <Toaster richColors position="bottom-right" />
      </div>
    );
  }

  // ─── Auth page ──────────────────────────────────────────────────────────
  if (authState === 'unauthenticated') {
    return (
      <div className="neo-bg flex min-h-screen">
        <Toaster richColors position="bottom-right" />

        {/* Left brand panel — desktop */}
        <div className="hidden lg:flex flex-col justify-center px-16 py-12 w-[52%] border-r-4 border-black bg-main">
          <div className="max-w-lg">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-base border-4 border-black bg-background flex items-center justify-center shadow-shadow">
                <Orbit size={28} />
              </div>
              <h1 className="font-heading text-6xl tracking-tight">FlowDrive</h1>
            </div>
            <p className="text-lg font-base mb-8 leading-relaxed">
              Your storage, elevated. Upload permanent files to Google Drive or share temporary files via Cloudflare R2.
            </p>

            <div className="flex flex-col gap-4">
              {[
                { icon: <Cloud size={20} />, title: 'Multi-Account Google Drive', desc: 'Connect unlimited Google accounts and route uploads' },
                { icon: <Clock size={20} />, title: 'Cloudflare R2 Temporary Shares', desc: 'Auto-expiring links for 1h, 24h, or 7 days' },
                { icon: <Zap  size={20} />, title: 'Parallel Upload Pool', desc: 'Up to 5x faster with live progress and cancel support' },
              ].map((feat, i) => (
                <div key={i} className="flex items-start gap-3 p-4 rounded-base border-2 border-black bg-background shadow-shadow">
                  <div className="mt-0.5 shrink-0">{feat.icon}</div>
                  <div>
                    <p className="font-heading text-sm">{feat.title}</p>
                    <p className="font-base text-xs mt-0.5 opacity-70">{feat.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right auth card */}
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="w-full max-w-md">
            {/* Mobile logo */}
            <div className="flex items-center gap-3 mb-8 lg:hidden">
              <div className="w-10 h-10 rounded-base border-2 border-black bg-main flex items-center justify-center shadow-shadow">
                <Orbit size={20} />
              </div>
              <h1 className="font-heading text-3xl">FlowDrive</h1>
            </div>

            <Card className="border-4 border-black shadow-[8px_8px_0_0_#000] rounded-base bg-background">
              <CardHeader className="pb-4">
                <CardTitle className="font-heading text-2xl">Welcome back</CardTitle>
                <CardDescription className="font-base">Sign in or create your FlowDrive account</CardDescription>
              </CardHeader>
              <CardContent>
                {error && (
                  <Alert className="mb-4 border-2 border-black bg-red-300 text-black rounded-base shadow-shadow">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="font-heading">Error</AlertTitle>
                    <AlertDescription className="font-base">{error}</AlertDescription>
                  </Alert>
                )}

                <Tabs defaultValue="login" onValueChange={() => setError('')}>
                  <TabsList className="w-full mb-6">
                    <TabsTrigger value="login"    className="flex-1 font-base">Sign In</TabsTrigger>
                    <TabsTrigger value="register" className="flex-1 font-base">Sign Up</TabsTrigger>
                  </TabsList>

                  <TabsContent value="login">
                    <form onSubmit={handleSignIn} className="flex flex-col gap-4">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="si-user" className="font-heading">Username</Label>
                        <Input id="si-user" placeholder="your_username" autoComplete="username"
                          value={siUser} onChange={e => setSiUser(e.target.value)} required />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="si-pass" className="font-heading">Password</Label>
                        <Input id="si-pass" type="password" placeholder="••••••••" autoComplete="current-password"
                          value={siPass} onChange={e => setSiPass(e.target.value)} required />
                      </div>
                      <Button type="submit" className="w-full mt-2" disabled={loading}>
                        {loading ? <RefreshCw size={16} className="animate-spin" /> : null}
                        {loading ? 'Signing in…' : 'Sign In'}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="register">
                    <form onSubmit={handleSignUp} className="flex flex-col gap-4">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="su-user" className="font-heading">Username</Label>
                        <Input id="su-user" placeholder="choose_a_username" autoComplete="username"
                          value={suUsername} onChange={e => setSuUsername(e.target.value)} required />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="su-pass" className="font-heading">Password</Label>
                        <Input id="su-pass" type="password" placeholder="••••••••" autoComplete="new-password"
                          value={suPass} onChange={e => setSuPass(e.target.value)} required />
                      </div>
                      <Button type="submit" className="w-full mt-2" disabled={loading}>
                        {loading ? <RefreshCw size={16} className="animate-spin" /> : null}
                        {loading ? 'Creating account…' : 'Create Account'}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>

                <div className="relative my-4 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t-2 border-black"></div></div>
                  <span className="relative bg-background px-3 font-heading text-xs uppercase opacity-70">or</span>
                </div>

                <Button variant="neutral" className="w-full bg-yellow-300 hover:bg-yellow-400 font-heading text-black border-2 border-black shadow-shadow" onClick={enterDemoMode}>
                  <Zap size={16} /> Explore Instant Demo
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // ─── Connect Google Drive page ────────────────────────────────────────────
  if (authState === 'needs_drive') {
    return (
      <div className="neo-bg flex flex-col items-center justify-center min-h-screen p-8">
        <Toaster richColors position="bottom-right" />
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3 mb-8 justify-center">
            <div className="w-12 h-12 rounded-base border-4 border-black bg-main flex items-center justify-center shadow-shadow">
              <Orbit size={24} />
            </div>
            <h1 className="font-heading text-3xl">FlowDrive</h1>
          </div>

          <Card className="border-4 border-black shadow-[8px_8px_0_0_#000] rounded-base bg-background text-center">
            <CardHeader>
              <div className="w-16 h-16 rounded-base border-4 border-black bg-main flex items-center justify-center shadow-shadow mx-auto mb-4">
                <Cloud size={32} />
              </div>
              <CardTitle className="font-heading text-2xl">Link Google Drive Space</CardTitle>
              <CardDescription className="font-base">
                Welcome, <strong>{user?.username}</strong>. Connect your Google account to store permanent files. We only request access to files FlowDrive creates.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {error && (
                <Alert className="border-2 border-black bg-red-300 text-black rounded-base text-left">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle className="font-heading">Error</AlertTitle>
                  <AlertDescription className="font-base">{error}</AlertDescription>
                </Alert>
              )}
              <Button id="connect-google" className="w-full" onClick={handleGoogleConnect}>
                <Cloud size={16} /> Connect Google Account
              </Button>
              <Button variant="neutral" className="w-full" onClick={handleLogout}>
                <LogOut size={16} /> Log Out
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ─── Main Dashboard ────────────────────────────────────────────────────────
  return (
    <TooltipProvider>
      <div className="neo-bg min-h-screen">
        <Toaster richColors position="bottom-right" />

        {/* ── Navbar ── */}
        <nav className="sticky top-0 z-50 bg-background border-b-4 border-black px-5 h-[60px] flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-base border-2 border-black bg-main flex items-center justify-center shadow-shadow">
              <Orbit size={16} />
            </div>
            <span className="font-heading text-xl">FlowDrive</span>
            {isDemo && (
              <Badge className="border-2 border-black bg-yellow-300 text-black font-heading text-[10px] shadow-shadow">
                DEMO PREVIEW
              </Badge>
            )}
          </div>

          {/* Right */}
          <div className="flex items-center gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <a href="https://github.com/ShubhangDoley/FlowDrive" target="_blank" rel="noreferrer">
                  <Button variant="neutral" size="icon" className="rounded-base">
                    <GithubIcon size={16} />
                  </Button>
                </a>
              </TooltipTrigger>
              <TooltipContent>View on GitHub</TooltipContent>
            </Tooltip>

            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8 border-2 border-black">
                <AvatarFallback className="bg-main text-black font-heading text-xs">
                  {userInitials(user?.display_name || user?.username || user?.email)}
                </AvatarFallback>
              </Avatar>
              <span className="font-base text-sm font-semibold hidden sm:block">
                {user?.display_name || user?.username || user?.email || 'User'}
              </span>
            </div>

            <Button variant="neutral" size="sm" onClick={handleLogout} className="rounded-base">
              <LogOut size={14} /> <span className="hidden sm:inline">Log Out</span>
            </Button>
          </div>
        </nav>

        {/* ── Main Content ── */}
        <main className="max-w-[1400px] mx-auto px-4 md:px-6 py-6 grid lg:grid-cols-[280px_1fr] gap-6">

          {/* ── LEFT SIDEBAR ── */}
          <aside className="flex flex-col gap-4">

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">

              {/* Storage card */}
              <Card className="border-2 border-black shadow-shadow rounded-base bg-background">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <HardDrive size={16} />
                    <p className="font-heading text-sm">Storage Used</p>
                  </div>
                  <Progress
                    value={totalUsagePct}
                    className="h-3 mb-1 border-2 border-black rounded-base [&>div]:bg-main"
                  />
                  <p className="font-base text-xs text-right mt-1">
                    {fmtBytes(totalUsedBytes)} / {totalLimitBytes > 0 ? fmtBytes(totalLimitBytes) : '—'}
                    {' '}({totalUsagePct}%)
                  </p>
                </CardContent>
              </Card>

              {/* Stats row */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="border-2 border-black shadow-shadow rounded-base bg-main">
                  <CardContent className="p-4 text-center">
                    <p className="font-heading text-3xl">{driveAccounts.length}</p>
                    <p className="font-base text-xs mt-1">Drives</p>
                  </CardContent>
                </Card>
                <Card className="border-2 border-black shadow-shadow rounded-base bg-background">
                  <CardContent className="p-4 text-center">
                    <p className="font-heading text-3xl">{files.length}</p>
                    <p className="font-base text-xs mt-1">Files</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Drive Accounts */}
            <Card className="border-2 border-black shadow-shadow rounded-base bg-background">
              <CardHeader className="pb-2 px-4 pt-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-heading text-base flex items-center gap-2">
                    <Cloud size={16} /> Drive Accounts
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="neutral" size="icon" className="h-7 w-7 rounded-base" onClick={handleGoogleConnect}>
                        <Plus size={14} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Add Google Drive</TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {driveError && (
                  <Alert className="mb-3 border-2 border-black bg-red-300 rounded-base text-sm">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="font-base">{driveError}</AlertDescription>
                  </Alert>
                )}

                {driveAccountsLoading ? (
                  <div className="flex items-center justify-center py-6 gap-2 text-sm font-base">
                    <RefreshCw size={14} className="animate-spin" /> Loading…
                  </div>
                ) : driveAccounts.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="font-base text-sm mb-3">No drives connected</p>
                    <Button className="w-full" onClick={handleGoogleConnect}>
                      <Plus size={14} /> Connect Drive
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {displayedDrives.map(account => (
                      <div
                        key={account.id}
                        className={`border-2 rounded-base p-3 cursor-pointer transition-all ${
                          selectedDriveAccountId === account.id
                            ? 'border-black bg-main shadow-shadow'
                            : 'border-black bg-secondary-background hover:bg-main/40'
                        }`}
                        onClick={() => setSelectedDriveAccountId(account.id)}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar className="w-6 h-6 border border-black shrink-0">
                              <AvatarFallback className="bg-background text-black font-heading text-[10px]">
                                {userInitials(account.account_email)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-base text-xs font-semibold truncate" title={account.account_email}>
                              {account.account_email}
                            </span>
                          </div>
                          {account.is_default && (
                            <Badge className="text-[10px] border-2 border-black bg-background text-black shrink-0">Default</Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-base text-xs opacity-70">{account.storage?.usage_pct ?? 0}% used</span>
                          <div className="flex gap-1">
                            {!account.is_default && (
                              <Button
                                variant="neutral" size="sm"
                                className="h-6 px-2 text-[10px] rounded-base"
                                onClick={e => { e.stopPropagation(); handleSetDefaultDrive(account.id); }}
                              >
                                <Star size={10} /> Default
                              </Button>
                            )}
                            <Button
                              variant="neutral" size="sm"
                              className="h-6 px-2 text-[10px] rounded-base border-black text-red-700 hover:bg-red-300"
                              onClick={e => { e.stopPropagation(); handleDisconnectDrive(account); }}
                            >
                              <X size={10} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {(hasMoreDrives || showAllDrives) && (
                      <Button variant="neutral" className="w-full mt-1 rounded-base text-xs"
                        onClick={() => setShowAllDrives(p => !p)}>
                        {showAllDrives ? 'Show Less' : `View All (${driveAccounts.length})`}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </aside>

          {/* ── RIGHT MAIN COLUMN ── */}
          <section className="flex flex-col gap-5">

            {/* Upload Destination + Drop Zone */}
            <Card className="border-2 border-black shadow-shadow rounded-base bg-background">
              <CardContent className="p-5">
                <div className="grid md:grid-cols-2 gap-5">

                  {/* Left: destination picker */}
                  <div className="flex flex-col gap-4">
                    <div>
                      <p className="font-heading text-sm mb-2 uppercase tracking-wide">Upload Destination</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: 'permanent', label: 'Permanent',    sub: 'Google Drive',           icon: <Cloud  size={16} /> },
                          { value: 'temporary', label: 'Temporary',    sub: 'R2 · Auto-deletes',      icon: <Clock  size={16} /> },
                        ].map(({ value, label, sub, icon }) => (
                          <button
                            key={value} id={`dest-${value}`}
                            onClick={() => setUploadIntent(value)}
                            className={`flex items-center gap-2 p-3 rounded-base border-2 border-black text-left transition-all cursor-pointer font-base
                              ${uploadIntent === value ? 'bg-main shadow-shadow translate-x-[2px] translate-y-[2px]' : 'bg-secondary-background hover:bg-main/50 shadow-shadow'}`}
                          >
                            <div className="shrink-0">{icon}</div>
                            <div className="min-w-0">
                              <p className="font-heading text-sm">{label}</p>
                              <p className="text-xs opacity-70 truncate">{sub}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Target drive selector */}
                    {uploadIntent === 'permanent' && driveAccounts.length > 0 && (
                      <div>
                        <p className="font-heading text-xs uppercase tracking-wide mb-1.5">Target Drive</p>
                        <div className="border-2 border-black rounded-base overflow-hidden">
                          {driveAccounts.map(account => (
                            <label key={account.id}
                              className={`flex items-center gap-2 px-3 py-2 cursor-pointer border-b-2 border-black last:border-b-0 font-base text-sm
                                ${selectedDriveAccountId === account.id ? 'bg-main' : 'bg-secondary-background hover:bg-main/40'}`}
                            >
                              <input type="radio" name="drive_target" value={account.id}
                                checked={selectedDriveAccountId === account.id}
                                onChange={() => setSelectedDriveAccountId(account.id)}
                                className="accent-black" />
                              <span className="truncate">{account.account_email}</span>
                              {account.is_default && <Badge className="ml-auto text-[10px] border border-black bg-background text-black">Default</Badge>}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Expiry picker */}
                    {uploadIntent === 'temporary' && (
                      <div>
                        <p className="font-heading text-xs uppercase tracking-wide mb-1.5">Auto-Deletion Period</p>
                        <Select value={expiresHours} onValueChange={setExpiresHours}>
                          <SelectTrigger id="expiry-select" className="border-2 border-black rounded-base bg-secondary-background font-base">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="border-2 border-black rounded-base">
                            <SelectItem value="1"   className="font-base">1 hour (60 minutes)</SelectItem>
                            <SelectItem value="24"  className="font-base">24 hours (1 day)</SelectItem>
                            <SelectItem value="168" className="font-base">7 days (1 week)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {/* Right: Drop zone */}
                  <div
                    id="upload-dropzone"
                    className={dropZoneClass}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false); }}
                    onDrop={e => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files) addFilesToQueue(e.dataTransfer.files); }}
                  >
                    <div className="w-14 h-14 rounded-base border-2 border-black bg-main flex items-center justify-center shadow-shadow">
                      <Upload size={28} />
                    </div>
                    <div className="text-center">
                      <p className="font-heading text-base">Drop files to upload</p>
                      <p className="font-base text-sm opacity-70">or click to browse</p>
                    </div>
                    <input type="file" multiple ref={fileInputRef} style={{ display: 'none' }}
                      onChange={e => { if (e.target.files) addFilesToQueue(e.target.files); e.target.value = ''; }} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Upload Queue */}
            {uploadQueue.length > 0 && (
              <Card className="border-2 border-black shadow-shadow rounded-base bg-background">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Upload size={16} />
                      <h3 className="font-heading text-base">Upload Queue</h3>
                      <Badge className="border-2 border-black bg-main text-black text-xs">
                        {completedCount}/{totalQueueCount} {uploadingCount > 0 ? `(${uploadingCount} active)` : ''}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Concurrency */}
                      <div className="flex border-2 border-black rounded-base overflow-hidden">
                        {[{ level: 1, label: '1x' }, { level: 3, label: '3x' }, { level: 5, label: '5x' }].map(({ level, label }) => (
                          <button key={level} onClick={() => setMaxConcurrency(level)}
                            className={`px-3 py-1 text-xs font-heading border-r-2 border-black last:border-r-0 transition-colors cursor-pointer
                              ${maxConcurrency === level ? 'bg-main' : 'bg-secondary-background hover:bg-main/50'}`}>
                            {label}
                          </button>
                        ))}
                      </div>
                      <Button variant="neutral" size="sm" className="rounded-base text-xs" onClick={retryFailedQueue}>
                        <RefreshCw size={12} /> Retry
                      </Button>
                      <Button variant="neutral" size="sm" className="rounded-base text-xs" onClick={clearCompletedQueue}>
                        <X size={12} /> Clear Done
                      </Button>
                    </div>
                  </div>

                  {/* Overall progress */}
                  {uploadingCount > 0 && (
                    <Progress value={overallQueuePct} className="h-2 mb-4 border-2 border-black rounded-base [&>div]:bg-main" />
                  )}

                  {/* Queue items */}
                  <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                    {uploadQueue.map(item => (
                      <div key={item.id} className="border-2 border-black rounded-base p-3 bg-secondary-background">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-base border-2 border-black bg-background flex items-center justify-center shrink-0">
                            <FileIcon size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="font-base text-sm font-semibold truncate">{item.file.name}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                <QueueStatusBadge status={item.status} />
                                <Button variant="neutral" size="icon" className="h-6 w-6 rounded-base"
                                  onClick={() => cancelOrRemoveQueueItem(item.id)}>
                                  <X size={12} />
                                </Button>
                              </div>
                            </div>
                            <p className="font-base text-xs opacity-60">{fmtBytes(item.total)}</p>
                          </div>
                        </div>

                        {item.status === 'uploading' && (
                          <Progress value={item.progressPct} className="mt-2 h-2 border-2 border-black rounded-base [&>div]:bg-main" />
                        )}
                        {item.status === 'error' && item.errorMsg && (
                          <p className="font-base text-xs text-red-700 mt-2">{item.errorMsg}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Files Section */}
            <div>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
                {/* Tabs */}
                <div className="flex border-2 border-black rounded-base overflow-hidden shadow-shadow">
                  {[
                    { value: 'permanent', label: 'Google Drive' },
                    { value: 'temporary', label: 'R2 Shares' },
                  ].map(({ value, label }) => (
                    <button key={value} id={`tab-${value}`} onClick={() => setActiveTab(value)}
                      className={`px-4 py-2 text-sm font-heading border-r-2 border-black last:border-r-0 cursor-pointer transition-colors
                        ${activeTab === value ? 'bg-main' : 'bg-secondary-background hover:bg-main/50'}`}>
                      {label}
                    </button>
                  ))}
                </div>

                {/* Search */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                  <Input
                    id="search-files"
                    type="search"
                    placeholder="Search files…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9 w-52 border-2 border-black rounded-base h-9"
                  />
                </div>
              </div>

              {/* File Table */}
              <Card className="border-2 border-black shadow-shadow rounded-base bg-background overflow-hidden">
                {/* Table header bar */}
                <div className="flex items-center justify-between px-5 py-3 border-b-2 border-black">
                  <div className="flex items-center gap-2">
                    <span className="font-heading text-sm">
                      {activeTab === 'permanent' ? 'Google Drive Files' : 'Cloudflare R2 Files'}
                    </span>
                    <Badge className="border-2 border-black bg-main text-black text-xs">{filteredFiles.length}</Badge>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="neutral" size="icon" className="h-7 w-7 rounded-base" onClick={fetchFiles}>
                        <RefreshCw size={13} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Refresh</TooltipContent>
                  </Tooltip>
                </div>

                {filteredFiles.length === 0 ? (
                  <div className="py-16 text-center px-6">
                    <div className="w-14 h-14 rounded-base border-2 border-black bg-secondary-background flex items-center justify-center mx-auto mb-4 shadow-shadow">
                      {activeTab === 'permanent' ? <Cloud size={24} /> : <Clock size={24} />}
                    </div>
                    <p className="font-heading text-base mb-1">
                      {searchQuery ? 'No matching files found' : `No ${activeTab} files yet`}
                    </p>
                    {!searchQuery && <p className="font-base text-sm opacity-60">Drop files above to upload to your space</p>}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b-2 border-black bg-main/30 hover:bg-main/30">
                          <TableHead className="font-heading text-xs uppercase tracking-wide py-3 px-5">File Name</TableHead>
                          {activeTab === 'permanent' && <TableHead className="font-heading text-xs uppercase tracking-wide py-3 px-5">Drive</TableHead>}
                          <TableHead className="font-heading text-xs uppercase tracking-wide py-3 px-5">Uploaded</TableHead>
                          <TableHead className="font-heading text-xs uppercase tracking-wide py-3 px-5">Size</TableHead>
                          {activeTab === 'temporary' && <TableHead className="font-heading text-xs uppercase tracking-wide py-3 px-5">Expires</TableHead>}
                          <TableHead className="font-heading text-xs uppercase tracking-wide py-3 px-5 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displayedFiles.map(f => {
                          const expiry = fmtExpiry(f.expires_at);
                          const isExpiringSoon = expiry?.includes('m left');
                          return (
                            <TableRow key={f.id} className="border-b-2 border-black last:border-b-0 hover:bg-secondary-background transition-colors">
                              <TableCell className="py-3 px-5">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-7 h-7 rounded-base border-2 border-black bg-secondary-background flex items-center justify-center shrink-0">
                                    <FileIcon size={13} />
                                  </div>
                                  <span className="font-base text-sm font-semibold truncate" title={f.filename}>{f.filename}</span>
                                </div>
                              </TableCell>
                              {activeTab === 'permanent' && (
                                <TableCell className="py-3 px-5 font-base text-sm opacity-70 truncate max-w-[160px]">
                                  {f.drive_account_email || 'Google Drive'}
                                </TableCell>
                              )}
                              <TableCell className="py-3 px-5 font-base text-sm opacity-60 whitespace-nowrap">{fmtDate(f.created_at)}</TableCell>
                              <TableCell className="py-3 px-5 font-base text-sm opacity-60 whitespace-nowrap">{fmtBytes(f.size_bytes)}</TableCell>
                              {activeTab === 'temporary' && (
                                <TableCell className="py-3 px-5">
                                  {expiry ? (
                                    <Badge className={`border-2 border-black text-xs ${isExpiringSoon ? 'bg-red-400' : 'bg-secondary-background'}`}>
                                      <Clock size={10} className="mr-1" /> {expiry}
                                    </Badge>
                                  ) : '—'}
                                </TableCell>
                              )}
                              <TableCell className="py-3 px-5">
                                <div className="flex justify-end gap-1">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="neutral" size="icon" className="h-7 w-7 rounded-base"
                                        onClick={e => { e.stopPropagation(); handleDownload(f); }}>
                                        <Download size={13} />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Download</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="neutral" size="icon" className="h-7 w-7 rounded-base border-black text-red-700 hover:bg-red-300"
                                        onClick={e => { e.stopPropagation(); handleDelete(f); }}>
                                        <Trash2 size={13} />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Delete</TooltipContent>
                                  </Tooltip>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Pagination */}
                {(hasMoreFiles || showAllFiles) && (
                  <div className="px-5 py-3 border-t-2 border-black text-center">
                    <Button variant="neutral" className="rounded-base text-sm" onClick={() => setShowAllFiles(p => !p)}>
                      {showAllFiles ? 'Show Less' : `View All (${filteredFiles.length} files)`}
                    </Button>
                  </div>
                )}
              </Card>
            </div>
          </section>
        </main>

        {/* ── Confirm Dialog ── */}
        <Dialog open={confirmModal.isOpen} onOpenChange={open => !open && setConfirmModal(p => ({ ...p, isOpen: false }))}>
          <DialogContent className="border-4 border-black shadow-[8px_8px_0_0_#000] rounded-base bg-background max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-heading text-lg">{confirmModal.title}</DialogTitle>
              <DialogDescription className="font-base text-sm">{confirmModal.message}</DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 flex-row justify-end">
              <Button variant="neutral" className="rounded-base"
                onClick={() => setConfirmModal(p => ({ ...p, isOpen: false }))}>
                Cancel
              </Button>
              <Button
                className={`rounded-base ${confirmModal.danger ? 'bg-red-400 hover:bg-red-500 border-black' : ''}`}
                onClick={confirmModal.onConfirm}>
                {confirmModal.confirmText}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
