import { useState } from 'react';
import { Download, Database } from 'lucide-react';
import { api, API_BASE, getErrorMessage } from '../services/api';
import useApi from '../hooks/useApi';
import { useApp } from '../context/AppContext';
import Card from '../components/common/Card';
import { ErrorState, Skeleton } from '../components/common/States';
import { downloadBlob } from '../utils/download';

// Every control here is functional: name/page size are saved in this browser,
// export downloads real data, and system status comes from /api/health.
export default function Settings() {
  const { profileName, setProfileName, pageSize, setPageSize, notify } = useApp();
  const [name, setName] = useState(profileName === 'Guest' ? '' : profileName);
  const [exporting, setExporting] = useState(false);
  const health = useApi(() => api.health(), []);

  const saveName = (e) => {
    e.preventDefault();
    setProfileName(name.trim() || 'Guest');
    notify('Profile name saved');
  };

  const exportAll = async () => {
    setExporting(true);
    try {
      downloadBlob(await api.exportExpensesCsv({}), 'all-expenses.csv');
      notify('All expenses exported');
    } catch (err) {
      notify(getErrorMessage(err), 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="row g-3">
      <div className="col-lg-6">
        <Card title="Preferences" subtitle="Saved in this browser only">
          <form onSubmit={saveName} className="mb-4">
            <label className="form-label" htmlFor="s-name">Display name</label>
            <div className="d-flex gap-2">
              <input id="s-name" className="form-control" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (shown as avatar initials)" />
              <button type="submit" className="btn btn-primary">Save</button>
            </div>
          </form>
          <label className="form-label" htmlFor="s-page">Rows per page (Expenses)</label>
          <select id="s-page" className="form-select" style={{ maxWidth: 200 }} value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); notify('Page size updated'); }}>
            {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <div className="small-label mt-3">Currency is fixed to Indian Rupees (₹). Budgets are set per category on the Categories page.</div>
        </Card>
      </div>

      <div className="col-lg-6">
        <Card title="Table & Data Management" subtitle="Truncate tables and seed sample test data">
          <div className="d-flex flex-column gap-3">
            <div>
              <div className="fw-semibold small mb-1">Populate Sample Data</div>
              <p className="text-muted-sw small mb-2">Seed multi-month realistic transactions to test charts, categories, and predictions.</p>
              <div className="d-flex gap-2">
                <select className="form-select form-select-sm" style={{ maxWidth: 180 }} id="react-seed-months" defaultValue="3">
                  <option value="1">1 Month</option>
                  <option value="3">3 Months (Default)</option>
                  <option value="6">6 Months</option>
                </select>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={async () => {
                    const months = Number(document.getElementById('react-seed-months')?.value || 3);
                    try {
                      const res = await api.seedDemo({ months, clearFirst: true });
                      notify(res.message || 'Sample data seeded successfully');
                      health.reload();
                    } catch (err) {
                      notify(getErrorMessage(err), 'error');
                    }
                  }}
                >
                  Load Sample Data
                </button>
              </div>
            </div>

            <hr className="my-1" />

            <div>
              <div className="fw-semibold text-danger small mb-1">Truncate Expenses Table</div>
              <p className="text-muted-sw small mb-2">Permanently erase all expenses and reset the autoincrement sequence.</p>
              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                onClick={async () => {
                  if (!window.confirm('Are you sure you want to truncate the expenses table? All expenses will be deleted.')) return;
                  try {
                    const res = await api.truncateExpenses('user');
                    notify(res.message || 'Expenses truncated');
                    health.reload();
                  } catch (err) {
                    notify(getErrorMessage(err), 'error');
                  }
                }}
              >
                Truncate Expenses
              </button>
            </div>

            <hr className="my-1" />

            <div>
              <div className="fw-semibold small mb-1">Export Data</div>
              <p className="text-muted-sw small mb-2">Download all transactions as a CSV spreadsheet for backup.</p>
              <button type="button" className="btn btn-outline-sw btn-sm" onClick={exportAll} disabled={exporting}>
                <Download size={14} className="me-1" /> {exporting ? 'Exporting…' : 'Export all expenses (CSV)'}
              </button>
            </div>
          </div>
        </Card>
      </div>

      <div className="col-12">
        <Card title="System status" action={<Database size={18} className="text-muted-sw" />}>
          {health.loading && !health.data ? <Skeleton height={60} /> : health.error ? (
            <ErrorState message={health.error} onRetry={health.reload} />
          ) : (
            <dl className="row mb-0">
              <dt className="col-sm-3">API</dt><dd className="col-sm-9"><span className="badge-sw">Online</span> <span className="text-muted-sw">{API_BASE}</span></dd>
              <dt className="col-sm-3">Database</dt><dd className="col-sm-9">{health.data.database.file} ({health.data.database.connected ? 'connected' : 'disconnected'})</dd>
              <dt className="col-sm-3">Records</dt><dd className="col-sm-9">{health.data.database.expenses} expenses · {health.data.database.categories} categories</dd>
              <dt className="col-sm-3">Uptime</dt><dd className="col-sm-9 mb-0">{Math.floor(health.data.uptime_seconds / 60)} min</dd>
            </dl>
          )}
        </Card>
      </div>
    </div>
  );
}
