import { AudioLines, ChevronRight, ClipboardCheck, History, LayoutDashboard, ShieldCheck, Target } from 'lucide-react'

const items = [ ['overview', 'Overview', LayoutDashboard], ['feedback', 'Interview feedback', ClipboardCheck], ['history', 'Saved reports', History] ]

export default function Workspace({ view, onNavigate, children }) {
  return <div className="app-frame">
    <aside className="sidebar">
      <a href="#main" className="brand" onClick={() => onNavigate('overview')} aria-label="Interview Studio home"><span className="brand-symbol"><AudioLines size={24} /></span><span>interview<span className="brand-sub">STUDIO</span></span></a>
      <div className="workspace-tag"><span className="tiny-dot" /> YOUR PRACTICE SPACE</div>
      <nav aria-label="Main navigation">{items.map(([id, label, Icon]) => <button key={id} className={`nav-item ${view === id ? 'active' : ''}`} aria-current={view === id ? 'page' : undefined} onClick={() => onNavigate(id)}><Icon size={18} />{label}<ChevronRight size={15} /></button>)}</nav>
      <div className="sidebar-note"><span className="note-icon"><Target size={20} /></span><h3>A little practice.<br />A lot more confidence.</h3><p>Make space to tell your story, one answer at a time.</p><div className="note-line" /></div>
      <div className="sidebar-footer"><ShieldCheck size={17} /><span>Your experience.<br /><strong>Your next step.</strong></span></div>
    </aside>
    <div className="workspace"><header className="topbar"><span>Workspace <ChevronRight size={14} /><strong>{items.find(([id]) => id === view)?.[1]}</strong></span></header><main id="main">{children}<footer className="page-footer"><span>INTERVIEW STUDIO</span><span>Thoughtful practice. Meaningful progress.</span></footer></main></div>
  </div>
}
