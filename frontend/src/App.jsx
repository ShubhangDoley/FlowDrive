import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Archive,
  Bell,
  ChevronDown,
  Cloud,
  CloudUpload,
  Download,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Grid2X2,
  HardDrive,
  LayoutList,
  LogOut,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react'

// ─── API helper ───────────────────────────────────────────────────────────────
// All requests go through the Vite proxy → http://127.0.0.1:8000
const API = {
  get: (path) => fetch(path, { credentials: 'include' }),
  post: (path, body) =>
    fetch(path, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  postForm: (path, formData) =>
    fetch(path, { method: 'POST', credentials: 'include', body: formData }),
  delete: (path) =>
    fetch(path, { method: 'DELETE', credentials: 'include' }),
}

// ─── File icon helper ─────────────────────────────────────────────────────────
function fileIcon(filename, provider) {
  if (provider === 'cloudflare_r2') return { Icon: Archive, tone: 'text-orange-600 bg-orange-50' }
  const ext = filename?.split('.').pop()?.toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext))
    return { Icon: FileImage, tone: 'text-fuchsia-600 bg-fuchsia-50' }
  if (['xls', 'xlsx', 'csv'].includes(ext))
    return { Icon: FileSpreadsheet, tone: 'text-emerald-600 bg-emerald-50' }
  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext))
    return { Icon: FileArchive, tone: 'text-amber-600 bg-amber-50' }
  return { Icon: FileText, tone: 'text-blue-600 bg-blue-50' }
}

function fmtBytes(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const diff = now - d
  if (diff < 86400000) return 'Today'
  if (diff < 172800000) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtExpiry(iso) {
  if (!iso) return null
  const diff = new Date(iso) - new Date()
  if (diff <= 0) return 'Expired'
  const h = Math.floor(diff / 3600000)
  if (h < 24) return `Expires in ${h}h`
  return `Expires in ${Math.floor(h / 24)}d`
}

function userInitials(name, email) {
  if (name) return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  return email?.slice(0, 2).toUpperCase() ?? '??'
}

// ─── Navigation ───────────────────────────────────────────────────────────────
const navigation = [
  { label: 'All files', icon: HardDrive, value: 'all' },
  { label: 'Permanent', icon: Cloud, value: 'permanent' },
  { label: 'Temporary', icon: Archive, value: 'temporary' },
]

// ─── Login page ───────────────────────────────────────────────────────────────
function LoginPage() {
  const [loading, setLoading] = useState(false)
  const params = new URLSearchParams(window.location.search)
  const error = params.get('error')

  function handleLogin() {
    setLoading(true)
    // Full redirect — Google will come back to /api/v1/auth/google/callback
    window.location.href = '/api/v1/auth/google/login'
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fa] px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1668e3] text-white shadow-lg">
            <Cloud size={28} strokeWidth={2.5} />
          </span>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-950">FlowDrive</h1>
          <p className="mt-2 text-sm text-slate-500">
            Smart file storage — permanent on Google Drive, temporary on Cloudflare R2.
          </p>
        </div>

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error === 'oauth_failed'
              ? 'Google sign-in failed. Please try again.'
              : 'Something went wrong. Please try again.'}
          </div>
        )}

        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <button
            id="btn-google-login"
            className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:shadow disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleLogin}
            disabled={loading}
            type="button"
          >
            {loading ? (
              <RefreshCw size={18} className="animate-spin text-slate-400" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
                <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.32-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
                <path fill="#FBBC05" d="M11.68 28.18A13.93 13.93 0 0 1 10.7 24c0-1.45.25-2.86.69-4.18v-5.7H4.34A23.93 23.93 0 0 0 0 24c0 3.88.93 7.55 2.56 10.81l7.12-5.52-.0 1.89z" />
                <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.34 5.7C13.42 14.62 18.27 10.75 24 10.75z" />
              </svg>
            )}
            {loading ? 'Redirecting…' : 'Continue with Google'}
          </button>

          <p className="mt-6 text-center text-xs text-slate-400">
            By signing in you agree to FlowDrive storing your tokens securely.
          </p>
        </div>
      </div>
    </main>
  )
}

// ─── Upload modal ─────────────────────────────────────────────────────────────
function UploadModal({ initialIntent, onClose, onSuccess }) {
  const [uploadIntent, setUploadIntent] = useState(initialIntent ?? 'permanent')
  const [expiresHours, setExpiresHours] = useState(24)
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const fileInput = useRef(null)

  async function handleUpload() {
    if (!selectedFile) return
    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('upload', selectedFile)
      form.append('intent', uploadIntent)
      if (uploadIntent === 'temporary') form.append('expiry_hours', expiresHours)

      const res = await API.postForm('/api/v1/files', form)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail ?? `Upload failed (${res.status})`)
      }
      onSuccess()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/35 p-4"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className="w-full max-w-lg bg-white shadow-2xl rounded-xl"
        aria-labelledby="upload-title"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="upload-title" className="text-base font-semibold text-slate-950">Upload file</h2>
            <p className="mt-0.5 text-sm text-slate-500">Choose where this file should live.</p>
          </div>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-800"
            title="Close"
            onClick={onClose}
            type="button"
          >
            <X size={19} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Destination picker */}
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Upload destination">
            <button
              className={`border rounded-lg p-3 text-left transition ${uploadIntent === 'permanent' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-slate-200 hover:border-slate-300'}`}
              type="button"
              onClick={() => setUploadIntent('permanent')}
            >
              <Cloud size={19} className="text-[#2970db]" />
              <span className="mt-2 block text-sm font-semibold">Permanent</span>
              <span className="mt-0.5 block text-xs text-slate-500">Google Drive</span>
            </button>
            <button
              className={`border rounded-lg p-3 text-left transition ${uploadIntent === 'temporary' ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500' : 'border-slate-200 hover:border-slate-300'}`}
              type="button"
              onClick={() => setUploadIntent('temporary')}
            >
              <Archive size={19} className="text-[#de6912]" />
              <span className="mt-2 block text-sm font-semibold">Temporary</span>
              <span className="mt-0.5 block text-xs text-slate-500">Cloudflare R2</span>
            </button>
          </div>

          {/* Expiry picker for temporary */}
          {uploadIntent === 'temporary' && (
            <label className="block text-sm font-medium text-slate-700">
              Expires after
              <select
                className="mt-2 block h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                value={expiresHours}
                onChange={(e) => setExpiresHours(Number(e.target.value))}
              >
                <option value={1}>1 hour</option>
                <option value={24}>24 hours</option>
                <option value={168}>7 days</option>
              </select>
            </label>
          )}

          {/* Drop zone */}
          <button
            className="flex min-h-40 w-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-5 text-center transition hover:border-blue-400 hover:bg-blue-50"
            type="button"
            onClick={() => fileInput.current?.click()}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#1668e3] shadow-sm">
              <CloudUpload size={20} />
            </span>
            <span className="mt-3 text-sm font-semibold text-slate-800">
              {selectedFile ? selectedFile.name : 'Choose a file to upload'}
            </span>
            <span className="mt-1 text-xs text-slate-500">
              {selectedFile ? fmtBytes(selectedFile.size) + ' selected' : 'or drop it here'}
            </span>
          </button>
          <input
            ref={fileInput}
            className="sr-only"
            type="file"
            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
          />

          {error && (
            <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4">
          <button
            className="h-10 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            id="btn-upload-submit"
            className="h-10 rounded-lg bg-[#1668e3] px-4 text-sm font-semibold text-white transition hover:bg-[#125bc7] disabled:cursor-not-allowed disabled:bg-slate-300 flex items-center gap-2"
            disabled={!selectedFile || uploading}
            onClick={handleUpload}
            type="button"
          >
            {uploading && <RefreshCw size={15} className="animate-spin" />}
            {uploading ? 'Uploading…' : `Upload to ${uploadIntent === 'permanent' ? 'Google Drive' : 'R2'}`}
          </button>
        </div>
      </section>
    </div>
  )
}

// ─── File row (table) ─────────────────────────────────────────────────────────
function FileRow({ file, onDelete, onDownload }) {
  const { Icon, tone } = fileIcon(file.filename, file.provider)
  const expiry = fmtExpiry(file.expires_at)

  return (
    <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <span className={`flex h-9 w-9 items-center justify-center rounded-md ${tone}`}>
            <Icon size={18} />
          </span>
          <span>
            <span className="block text-sm font-medium text-slate-800">{file.filename}</span>
            {expiry && <span className="mt-0.5 block text-xs font-medium text-[#c8500a]">{expiry}</span>}
          </span>
        </div>
      </td>
      <td className="px-4 py-3.5 text-sm text-slate-600">
        {file.provider === 'google_drive' ? 'Google Drive' : 'Cloudflare R2'}
      </td>
      <td className="px-4 py-3.5 text-sm text-slate-600">{fmtDate(file.created_at)}</td>
      <td className="px-4 py-3.5 text-sm text-slate-600">{fmtBytes(file.size_bytes)}</td>
      <td className="px-4 py-3.5">
        <div className="flex justify-end gap-0.5">
          <button
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700"
            title={`Download ${file.filename}`}
            type="button"
            onClick={() => onDownload(file)}
          >
            <Download size={17} />
          </button>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-red-100 hover:text-red-600"
            title={`Delete ${file.filename}`}
            type="button"
            onClick={() => onDelete(file)}
          >
            <Trash2 size={17} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── File tile (grid) ─────────────────────────────────────────────────────────
function FileTile({ file, onDelete, onDownload }) {
  const { Icon, tone } = fileIcon(file.filename, file.provider)
  const expiry = fmtExpiry(file.expires_at)
  const [open, setOpen] = useState(false)

  return (
    <article className="relative bg-white p-4 hover:bg-slate-50">
      <div className="flex items-start justify-between">
        <span className={`flex h-10 w-10 items-center justify-center rounded-md ${tone}`}>
          <Icon size={20} />
        </span>
        <div className="relative">
          <button
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700"
            title="More actions"
            type="button"
            onClick={() => setOpen((v) => !v)}
          >
            <MoreHorizontal size={18} />
          </button>
          {open && (
            <div className="absolute right-0 top-9 z-10 w-36 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              <button className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={() => { onDownload(file); setOpen(false) }} type="button">
                <Download size={15} /> Download
              </button>
              <button className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50" onClick={() => { onDelete(file); setOpen(false) }} type="button">
                <Trash2 size={15} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
      <h3 className="mt-5 truncate text-sm font-medium text-slate-800">{file.filename}</h3>
      <p className="mt-1 text-xs text-slate-500">
        {fmtBytes(file.size_bytes)} · {file.provider === 'google_drive' ? 'Drive' : 'R2'}
      </p>
      {expiry && <p className="mt-2 text-xs font-medium text-[#c8500a]">{expiry}</p>}
    </article>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ user, onLogout }) {
  const [activeView, setActiveView] = useState('all')
  const [query, setQuery] = useState('')
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadIntent, setUploadIntent] = useState('permanent')
  const [isGrid, setIsGrid] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const fetchFiles = useCallback(async () => {
    setLoading(true)
    try {
      const res = await API.get('/api/v1/files')
      if (res.ok) {
        const data = await res.json()
        setFiles(data.files ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchFiles() }, [fetchFiles])

  async function handleDelete(file) {
    if (!confirm(`Delete "${file.filename}"? This cannot be undone.`)) return
    const res = await API.delete(`/api/v1/files/${file.id}`)
    if (res.ok) fetchFiles()
    else alert('Delete failed. Please try again.')
  }

  async function handleDownload(file) {
    window.open(`/api/v1/files/${file.id}/download`, '_blank')
  }

  async function handleLogout() {
    await API.post('/api/v1/auth/logout', {})
    onLogout()
  }

  function openUpload(intent = 'permanent') {
    setUploadIntent(intent)
    setUploadOpen(true)
  }

  const displayed = files.filter((f) => {
    const matchView = activeView === 'all' || f.intent === activeView
    return matchView && f.filename.toLowerCase().includes(query.toLowerCase())
  })

  const viewLabel = navigation.find((n) => n.value === activeView)?.label

  const driveCount = files.filter((f) => f.provider === 'google_drive').length
  const r2Count = files.filter((f) => f.provider === 'cloudflare_r2').length

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#172033]">
      {/* Header */}
      <header className="sticky top-0 z-20 flex h-16 items-center border-b border-slate-200 bg-white px-4 lg:px-7">
        <a className="flex items-center gap-2.5 font-semibold tracking-tight text-slate-950" href="#">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1668e3] text-white shadow-sm">
            <Cloud size={18} strokeWidth={2.5} />
          </span>
          FlowDrive
        </a>

        <label className="relative ml-6 hidden max-w-xl flex-1 md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
            type="search"
            placeholder="Search your files"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        <div className="ml-auto flex items-center gap-1.5 relative">
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            title="Notifications"
            type="button"
          >
            <Bell size={19} />
          </button>

          <button
            id="btn-user-menu"
            className="ml-1 flex h-9 items-center gap-2 rounded-md px-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            type="button"
            onClick={() => setUserMenuOpen((v) => !v)}
          >
            {user.avatar_url ? (
              <img src={user.avatar_url} className="h-7 w-7 rounded-full object-cover" alt="" />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#d9e9ff] text-xs font-bold text-[#1755a6]">
                {userInitials(user.display_name, user.email)}
              </span>
            )}
            <span className="hidden sm:block">{user.display_name?.split(' ')[0] ?? user.email}</span>
            <ChevronDown size={16} className="hidden text-slate-400 sm:block" />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-12 z-30 w-52 rounded-xl border border-slate-200 bg-white py-2 shadow-xl">
              <div className="px-4 py-2 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-800 truncate">{user.display_name}</p>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
                {user.has_drive_connected && (
                  <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                    <Cloud size={10} /> Drive connected
                  </span>
                )}
              </div>
              <button
                id="btn-logout"
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-red-600"
                onClick={handleLogout}
                type="button"
              >
                <LogOut size={15} /> Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1440px]">
        {/* Sidebar */}
        <aside className="hidden min-h-[calc(100vh-4rem)] w-60 shrink-0 border-r border-slate-200 bg-white p-4 lg:block">
          <button
            id="btn-upload-open"
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#1668e3] px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#125bc7] focus:outline-none focus:ring-4 focus:ring-blue-200"
            type="button"
            onClick={() => openUpload()}
          >
            <Plus size={18} />
            Upload files
          </button>

          <nav className="mt-6 space-y-1" aria-label="File views">
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = activeView === item.value
              return (
                <button
                  className={`flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium transition ${isActive ? 'bg-blue-50 text-[#165dca]' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                  key={item.value}
                  onClick={() => setActiveView(item.value)}
                  type="button"
                >
                  <Icon size={18} />
                  {item.label}
                </button>
              )
            })}
          </nav>

          <div className="mt-8 border-t border-slate-200 pt-5">
            <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Storage</p>
            <div className="mt-3 px-3 space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Google Drive</span>
                  <span>{driveCount} file{driveCount !== 1 ? 's' : ''}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-[#4285f4] transition-all" style={{ width: driveCount ? `${Math.min(driveCount * 10, 100)}%` : '0%' }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Cloudflare R2</span>
                  <span>{r2Count} file{r2Count !== 1 ? 's' : ''}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-[#f48120] transition-all" style={{ width: r2Count ? `${Math.min(r2Count * 10, 100)}%` : '0%' }} />
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <section className="min-w-0 flex-1 px-4 py-7 sm:px-7 lg:px-10">
          <div id="top" className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">Workspace</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{viewLabel}</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
                title="Refresh"
                type="button"
                onClick={fetchFiles}
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
              <button
                className="inline-flex h-10 items-center gap-2 rounded-md bg-[#1668e3] px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#125bc7] focus:outline-none focus:ring-4 focus:ring-blue-200 lg:hidden"
                type="button"
                onClick={() => openUpload()}
              >
                <Plus size={18} />
                Upload
              </button>
            </div>
          </div>

          {/* Quick action cards */}
          <div className="mt-7 grid gap-4 md:grid-cols-2">
            <button
              className="group flex min-h-32 items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 text-left transition hover:border-blue-300 hover:shadow-sm"
              type="button"
              onClick={() => openUpload('permanent')}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#e9f1ff] text-[#2970db]">
                <Cloud size={21} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900">Permanent storage</span>
                <span className="mt-1 block text-sm leading-5 text-slate-500">Upload to Google Drive — files stay forever</span>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#1668e3]">
                  Upload permanent file <Upload size={15} />
                </span>
              </span>
            </button>
            <button
              className="group flex min-h-32 items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 text-left transition hover:border-orange-300 hover:shadow-sm"
              type="button"
              onClick={() => openUpload('temporary')}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#fff1e5] text-[#de6912]">
                <Archive size={20} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900">Temporary storage</span>
                <span className="mt-1 block text-sm leading-5 text-slate-500">Upload to Cloudflare R2 with auto-expiry</span>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#c8500a]">
                  Upload temporary file <Upload size={15} />
                </span>
              </span>
            </button>
          </div>

          {/* Files table/grid */}
          <div className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">Files</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                  {displayed.length}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <label className="relative md:hidden">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    className="h-9 w-44 rounded-md border border-slate-200 pl-8 pr-2 text-sm outline-none focus:border-blue-500"
                    placeholder="Search files"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <div className="flex rounded-md border border-slate-200 p-0.5">
                  <button
                    className={`flex h-7 w-7 items-center justify-center rounded ${!isGrid ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:text-slate-700'}`}
                    title="List view"
                    type="button"
                    onClick={() => setIsGrid(false)}
                  >
                    <LayoutList size={16} />
                  </button>
                  <button
                    className={`flex h-7 w-7 items-center justify-center rounded ${isGrid ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:text-slate-700'}`}
                    title="Grid view"
                    type="button"
                    onClick={() => setIsGrid(true)}
                  >
                    <Grid2X2 size={16} />
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-slate-400">
                <RefreshCw size={24} className="animate-spin" />
                <p className="text-sm">Loading your files…</p>
              </div>
            ) : displayed.length === 0 ? (
              <div className="flex min-h-72 flex-col items-center justify-center px-4 text-center">
                <FolderOpen size={32} className="text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-800">
                  {files.length === 0 ? 'No files uploaded yet' : 'No matching files'}
                </p>
                {files.length === 0 ? (
                  <button
                    className="mt-4 text-sm font-semibold text-[#1668e3] hover:text-[#125bc7]"
                    onClick={() => openUpload()}
                    type="button"
                  >
                    Upload your first file
                  </button>
                ) : (
                  <button
                    className="mt-4 text-sm font-semibold text-[#1668e3] hover:text-[#125bc7]"
                    onClick={() => { setQuery(''); setActiveView('all') }}
                    type="button"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : isGrid ? (
              <div className="grid gap-px bg-slate-200 sm:grid-cols-2 xl:grid-cols-3">
                {displayed.map((f) => (
                  <FileTile key={f.id} file={f} onDelete={handleDelete} onDownload={handleDownload} />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left">
                  <thead className="border-b border-slate-100 text-xs font-semibold uppercase tracking-[0.06em] text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Name</th>
                      <th className="px-4 py-3 font-semibold">Location</th>
                      <th className="px-4 py-3 font-semibold">Uploaded</th>
                      <th className="px-4 py-3 font-semibold">Size</th>
                      <th className="w-24 px-4 py-3"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map((f) => (
                      <FileRow key={f.id} file={f} onDelete={handleDelete} onDownload={handleDownload} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>

      {uploadOpen && (
        <UploadModal
          initialIntent={uploadIntent}
          onClose={() => setUploadOpen(false)}
          onSuccess={fetchFiles}
        />
      )}
    </main>
  )
}

// ─── Root app — handles auth state ────────────────────────────────────────────
export default function App() {
  const [authState, setAuthState] = useState('loading') // 'loading' | 'unauthenticated' | 'authenticated'
  const [user, setUser] = useState(null)

  useEffect(() => {
    API.get('/api/v1/auth/me')
      .then(async (res) => {
        if (res.ok) {
          setUser(await res.json())
          setAuthState('authenticated')
          // Clean up any ?error= from URL after successful auth
          if (window.location.search) window.history.replaceState({}, '', window.location.pathname)
        } else {
          setAuthState('unauthenticated')
        }
      })
      .catch(() => setAuthState('unauthenticated'))
  }, [])

  if (authState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f8fa]">
        <div className="flex flex-col items-center gap-4 text-slate-400">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1668e3] text-white shadow">
            <Cloud size={24} />
          </span>
          <RefreshCw size={20} className="animate-spin" />
        </div>
      </div>
    )
  }

  if (authState === 'unauthenticated') {
    return <LoginPage />
  }

  return (
    <Dashboard
      user={user}
      onLogout={() => { setUser(null); setAuthState('unauthenticated') }}
    />
  )
}
