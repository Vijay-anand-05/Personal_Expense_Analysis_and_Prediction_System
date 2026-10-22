import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Receipt, Tags, BarChart3, Sparkles, Settings } from 'lucide-react';

export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/expenses', label: 'Expenses', icon: Receipt },
  { to: '/categories', label: 'Categories', icon: Tags },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/predictions', label: 'Predictions', icon: Sparkles },
  { to: '/settings', label: 'Settings', icon: Settings },
];

// Small geometric mark: three rising bars, the last one in the forecast colour.
function Mark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="1.5" y="9" width="3.2" height="5.5" rx="1" fill="#DDF3E4" />
      <rect x="6.4" y="5.5" width="3.2" height="9" rx="1" fill="#DDF3E4" />
      <rect x="11.3" y="1.5" width="3.2" height="13" rx="1" fill="#F4A261" />
    </svg>
  );
}

export default function Sidebar({ open, onClose }) {
  return (
    <>
      <div className={`sidebar-backdrop ${open ? 'open' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Main navigation">
        <NavLink to="/" className="brand" onClick={onClose} title="Personal Expense Analysis and Prediction System">
          <span className="brand-mark"><Mark /></span>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--sw-text)' }}>Personal Expense</div>
            <div style={{ fontSize: '0.67rem', fontWeight: 600, color: 'var(--sw-mint-strong)', letterSpacing: '0.02em' }}>Analysis & Prediction</div>
          </div>
        </NavLink>
        <nav>
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={onClose} className={({ isActive }) => `nav-item-sw ${isActive ? 'active' : ''}`}>
              <Icon size={17} strokeWidth={1.9} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">Forecasts use transparent averaging, not a trained ML model.</div>
      </aside>
    </>
  );
}
