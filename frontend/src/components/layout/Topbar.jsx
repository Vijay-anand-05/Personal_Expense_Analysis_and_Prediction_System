import { Link, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import MonthPicker from '../common/MonthPicker';
import { useApp } from '../../context/AppContext';

const PAGES = {
  '/': { title: 'Dashboard', desc: 'Where your money went, and where it is heading.' },
  '/expenses': { title: 'Expenses', desc: 'Record, search and manage every transaction.' },
  '/categories': { title: 'Categories', desc: 'Organise spending and set monthly budgets.' },
  '/analytics': { title: 'Analytics', desc: 'Trends, comparisons and budget performance over any period.' },
  '/predictions': { title: 'Predictions', desc: 'Forecasts built from your own spending history.' },
  '/settings': { title: 'Settings', desc: 'Preferences, data export and system status.' },
};
// Pages whose data depends on the selected month.
const MONTH_PAGES = ['/', '/predictions'];

export default function Topbar({ onMenu }) {
  const { pathname } = useLocation();
  const { month, setMonth, profileName } = useApp();
  const page = PAGES[pathname] || { title: 'Page not found', desc: '' };
  const initials = (profileName || 'G').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <header className="topbar">
      <button type="button" className="btn btn-outline-sw btn-sm d-lg-none" onClick={onMenu} aria-label="Open navigation menu">
        <Menu size={18} />
      </button>
      <div className="flex-grow-1" style={{ minWidth: 0 }}>
        <h1 className="page-title">{page.title}</h1>
        {page.desc && <p className="page-desc">{page.desc}</p>}
      </div>
      {MONTH_PAGES.includes(pathname) && <MonthPicker value={month} onChange={setMonth} />}
      <Link to="/settings" className="avatar" title={`${profileName} - profile settings`} aria-label="Profile settings">{initials}</Link>
    </header>
  );
}
