import { useRef, useState } from 'react'
import {
  Archive,
  Bell,
  ChevronDown,
  Cloud,
  CloudUpload,
  Download,
  FileImage,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Grid2X2,
  HardDrive,
  LayoutList,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Trash2,
  Upload,
  X,
} from 'lucide-react'

const files = [
  { name: 'Project roadmap.pdf', type: 'PDF', size: '2.4 MB', updated: 'Today, 10:42', location: 'Google Drive', intent: 'permanent', icon: FileText, tone: 'text-blue-600 bg-blue-50' },
  { name: 'Product shots', type: 'Folder', size: '12 files', updated: 'Yesterday', location: 'Google Drive', intent: 'permanent', icon: FolderOpen, tone: 'text-amber-600 bg-amber-50' },
  { name: 'Q2_financials.xlsx', type: 'Spreadsheet', size: '847 KB', updated: 'Jun 21, 2026', location: 'Google Drive', intent: 'permanent', icon: FileSpreadsheet, tone: 'text-emerald-600 bg-emerald-50' },
  { name: 'Release candidate.zip', type: 'Archive', size: '38.6 MB', updated: 'Jun 20, 2026', location: 'Cloudflare R2', intent: 'temporary', expiry: 'Expires in 19h', icon: Archive, tone: 'text-orange-600 bg-orange-50' },
  { name: 'campaign-banner.png', type: 'Image', size: '3.1 MB', updated: 'Jun 19, 2026', location: 'Cloudflare R2', intent: 'temporary', expiry: 'Expires in 5d', icon: FileImage, tone: 'text-fuchsia-600 bg-fuchsia-50' },
]

const navigation = [
  { label: 'All files', icon: HardDrive, value: 'all' },
  { label: 'Permanent', icon: Cloud, value: 'permanent' },
  { label: 'Temporary', icon: Archive, value: 'temporary' },
]

function App() {
  const [activeView, setActiveView] = useState('all')
  const [query, setQuery] = useState('')
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [uploadIntent, setUploadIntent] = useState('permanent')
  const [selectedFile, setSelectedFile] = useState(null)
  const [isGrid, setIsGrid] = useState(false)
  const fileInput = useRef(null)

  const displayedFiles = files.filter((file) => {
    const matchesView = activeView === 'all' || file.intent === activeView
    return matchesView && file.name.toLowerCase().includes(query.toLowerCase())
  })

  const viewLabel = navigation.find((item) => item.value === activeView)?.label

  function openUpload(intent = 'permanent') {
    setUploadIntent(intent)
    setSelectedFile(null)
    setIsUploadOpen(true)
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#172033]">
      <header className="sticky top-0 z-20 flex h-16 items-center border-b border-slate-200 bg-white px-4 lg:px-7">
        <a className="flex items-center gap-2.5 font-semibold tracking-[0] text-slate-950" href="#top">
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
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <div className="ml-auto flex items-center gap-1.5">
          <button className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800" title="Notifications" type="button">
            <Bell size={19} />
          </button>
          <button className="ml-1 flex h-9 items-center gap-2 rounded-md px-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100" type="button">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#d9e9ff] text-xs font-bold text-[#1755a6]">SJ</span>
            <span className="hidden sm:block">Shubh</span>
            <ChevronDown size={16} className="hidden text-slate-400 sm:block" />
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1440px]">
        <aside className="hidden min-h-[calc(100vh-4rem)] w-60 shrink-0 border-r border-slate-200 bg-white p-4 lg:block">
          <button
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
            <div className="mt-3 px-3">
              <div className="flex items-center justify-between text-xs text-slate-600"><span>Google Drive</span><span>14.2 GB</span></div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-[57%] rounded-full bg-[#4285f4]" /></div>
              <div className="mt-4 flex items-center justify-between text-xs text-slate-600"><span>Cloudflare R2</span><span>41.7 MB</span></div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-[23%] rounded-full bg-[#f48120]" /></div>
            </div>
          </div>

          <button className="mt-8 flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900" type="button">
            <Settings size={18} />
            Settings
          </button>
        </aside>

        <section className="min-w-0 flex-1 px-4 py-7 sm:px-7 lg:px-10">
          <div id="top" className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">Workspace</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-[0] text-slate-950">{viewLabel}</h1>
            </div>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-md bg-[#1668e3] px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#125bc7] focus:outline-none focus:ring-4 focus:ring-blue-200 lg:hidden"
              type="button"
              onClick={() => openUpload()}
            >
              <Plus size={18} />
              Upload
            </button>
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-2">
            <button className="group flex min-h-32 items-start gap-4 border border-slate-200 bg-white p-5 text-left transition hover:border-blue-300 hover:shadow-sm" type="button" onClick={() => openUpload('permanent')}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#e9f1ff] text-[#2970db]"><Cloud size={21} /></span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900">Permanent storage</span>
                <span className="mt-1 block text-sm leading-5 text-slate-500">Upload to Google Drive</span>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#1668e3]">Upload permanent file <Upload size={15} /></span>
              </span>
            </button>
            <button className="group flex min-h-32 items-start gap-4 border border-slate-200 bg-white p-5 text-left transition hover:border-orange-300 hover:shadow-sm" type="button" onClick={() => openUpload('temporary')}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#fff1e5] text-[#de6912]"><Archive size={20} /></span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900">Temporary storage</span>
                <span className="mt-1 block text-sm leading-5 text-slate-500">Upload to Cloudflare R2 with expiry</span>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#c8500a]">Upload temporary file <Upload size={15} /></span>
              </span>
            </button>
          </div>

          <div className="mt-8 overflow-hidden border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">Files</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{displayedFiles.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <label className="relative md:hidden">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input className="h-9 w-44 rounded-md border border-slate-200 pl-8 pr-2 text-sm outline-none focus:border-blue-500" placeholder="Search files" type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
                </label>
                <div className="flex rounded-md border border-slate-200 p-0.5">
                  <button className={`flex h-7 w-7 items-center justify-center rounded ${!isGrid ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:text-slate-700'}`} title="List view" type="button" onClick={() => setIsGrid(false)}><LayoutList size={16} /></button>
                  <button className={`flex h-7 w-7 items-center justify-center rounded ${isGrid ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:text-slate-700'}`} title="Grid view" type="button" onClick={() => setIsGrid(true)}><Grid2X2 size={16} /></button>
                </div>
              </div>
            </div>

            {displayedFiles.length === 0 ? (
              <div className="flex min-h-72 flex-col items-center justify-center px-4 text-center">
                <FolderOpen size={32} className="text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-800">No matching files</p>
                <button className="mt-4 text-sm font-semibold text-[#1668e3] hover:text-[#125bc7]" onClick={() => { setQuery(''); setActiveView('all') }} type="button">Clear filters</button>
              </div>
            ) : isGrid ? (
              <div className="grid gap-px bg-slate-200 sm:grid-cols-2 xl:grid-cols-3">
                {displayedFiles.map((file) => <FileTile file={file} key={file.name} />)}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left">
                  <thead className="border-b border-slate-100 text-xs font-semibold uppercase tracking-[0.06em] text-slate-400"><tr><th className="px-4 py-3 font-semibold">Name</th><th className="px-4 py-3 font-semibold">Location</th><th className="px-4 py-3 font-semibold">Last modified</th><th className="px-4 py-3 font-semibold">Size</th><th className="w-24 px-4 py-3"><span className="sr-only">Actions</span></th></tr></thead>
                  <tbody>{displayedFiles.map((file) => <FileRow file={file} key={file.name} />)}</tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>

      {isUploadOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/35 p-4" role="presentation" onMouseDown={() => setIsUploadOpen(false)}>
          <section className="w-full max-w-lg bg-white shadow-2xl" aria-labelledby="upload-title" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div><h2 id="upload-title" className="text-base font-semibold text-slate-950">Upload files</h2><p className="mt-1 text-sm text-slate-500">Choose where this file should live.</p></div>
              <button className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-800" title="Close upload dialog" onClick={() => setIsUploadOpen(false)} type="button"><X size={19} /></button>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Upload destination">
                <button className={`border p-3 text-left transition ${uploadIntent === 'permanent' ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-slate-200 hover:border-slate-300'}`} type="button" onClick={() => setUploadIntent('permanent')}><Cloud size={19} className="text-[#2970db]" /><span className="mt-3 block text-sm font-semibold">Permanent</span><span className="mt-0.5 block text-xs text-slate-500">Google Drive</span></button>
                <button className={`border p-3 text-left transition ${uploadIntent === 'temporary' ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500' : 'border-slate-200 hover:border-slate-300'}`} type="button" onClick={() => setUploadIntent('temporary')}><Archive size={19} className="text-[#de6912]" /><span className="mt-3 block text-sm font-semibold">Temporary</span><span className="mt-0.5 block text-xs text-slate-500">Cloudflare R2</span></button>
              </div>

              {uploadIntent === 'temporary' && <label className="mt-5 block text-sm font-medium text-slate-700">Expires after<select className="mt-2 block h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100" defaultValue="24 hours"><option>1 hour</option><option>24 hours</option><option>7 days</option></select></label>}

              <button className="mt-5 flex min-h-40 w-full flex-col items-center justify-center border border-dashed border-slate-300 bg-slate-50 px-5 text-center transition hover:border-blue-400 hover:bg-blue-50" type="button" onClick={() => fileInput.current?.click()}>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#1668e3] shadow-sm"><CloudUpload size={20} /></span>
                <span className="mt-3 text-sm font-semibold text-slate-800">{selectedFile ? selectedFile.name : 'Choose a file to upload'}</span>
                <span className="mt-1 text-xs text-slate-500">{selectedFile ? `${(selectedFile.size / 1024 / 1024).toFixed(1)} MB selected` : 'or drop it here'}</span>
              </button>
              <input ref={fileInput} className="sr-only" type="file" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} />
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4"><button className="h-10 rounded-md px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100" onClick={() => setIsUploadOpen(false)} type="button">Cancel</button><button className="h-10 rounded-md bg-[#1668e3] px-4 text-sm font-semibold text-white transition hover:bg-[#125bc7] disabled:cursor-not-allowed disabled:bg-slate-300" disabled={!selectedFile} type="button">Upload to {uploadIntent === 'permanent' ? 'Google Drive' : 'Cloudflare R2'}</button></div>
          </section>
        </div>
      )}
    </main>
  )
}

function FileRow({ file }) {
  const Icon = file.icon
  return <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50"><td className="px-4 py-3.5"><div className="flex items-center gap-3"><span className={`flex h-9 w-9 items-center justify-center rounded-md ${file.tone}`}><Icon size={18} /></span><span><span className="block text-sm font-medium text-slate-800">{file.name}</span>{file.expiry && <span className="mt-0.5 block text-xs font-medium text-[#c8500a]">{file.expiry}</span>}</span></div></td><td className="px-4 py-3.5 text-sm text-slate-600">{file.location}</td><td className="px-4 py-3.5 text-sm text-slate-600">{file.updated}</td><td className="px-4 py-3.5 text-sm text-slate-600">{file.size}</td><td className="px-4 py-3.5"><div className="flex justify-end gap-0.5"><button className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700" title={`Download ${file.name}`} type="button"><Download size={17} /></button><button className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700" title={`More actions for ${file.name}`} type="button"><MoreHorizontal size={18} /></button></div></td></tr>
}

function FileTile({ file }) {
  const Icon = file.icon
  return <article className="bg-white p-4 hover:bg-slate-50"><div className="flex items-start justify-between"><span className={`flex h-10 w-10 items-center justify-center rounded-md ${file.tone}`}><Icon size={20} /></span><button className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700" title={`More actions for ${file.name}`} type="button"><MoreHorizontal size={18} /></button></div><h3 className="mt-5 truncate text-sm font-medium text-slate-800">{file.name}</h3><p className="mt-1 text-xs text-slate-500">{file.size} · {file.location}</p>{file.expiry && <p className="mt-3 text-xs font-medium text-[#c8500a]">{file.expiry}</p>}</article>
}

export default App
