import { useEffect, useState } from 'react';
import { reportAPI } from '@/api/endpoints';
import { LoadingSpinner } from '@/components/ui';
import { formatCurrency } from '@/utils/helpers';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import {
  TrendingUp, DollarSign, Users, Clock,
  FolderKanban, AlertTriangle, CheckCircle2, Activity,
  FileText, FileSpreadsheet, Settings2, X, ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';

type ReportTab = 'overview' | 'budget' | 'time' | 'team' | 'workload';

const COLORS = ['#6366f1', '#22c55e', '#eab308', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];
const STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8', ongoing: '#6366f1',
  on_hold: '#eab308', completed: '#22c55e', cancelled: '#64748b', expired: '#ef4444',
};

type ExportFilters = {
  status: string;
  pillar: string;
  date_from: string;
  date_to: string;
  columns: string[];
};

const OVERVIEW_COLUMNS = [
  { key: 'title', label: 'Project Title' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'start_date', label: 'Start Date' },
  { key: 'end_date', label: 'End Date' },
  { key: 'progress', label: 'Progress' },
  { key: 'budget', label: 'Budget (RM)' },
  { key: 'spent', label: 'Spent (RM)' },
  { key: 'health', label: 'Health Score' },
];

function CustomReportPanel({
  tab, filters, setFilters, onClose,
}: {
  tab: ReportTab;
  filters: ExportFilters;
  setFilters: (f: ExportFilters) => void;
  onClose: () => void;
}) {
  const toggleColumn = (key: string) => {
    const cols = filters.columns.includes(key)
      ? filters.columns.filter((c) => c !== key)
      : [...filters.columns, key];
    setFilters({ ...filters, columns: cols });
  };

  return (
    <div className="card p-6 border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/10">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-indigo-600" />
          <h3 className="text-base font-semibold text-slate-800 dark:text-white">Custom Report Options</h3>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Filter by Status</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="ONGOING">Ongoing</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="COMPLETED">Completed</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Filter by Pillar / Category</label>
          <input
            type="text"
            placeholder="e.g. ICT, Infrastructure"
            value={filters.pillar}
            onChange={(e) => setFilters({ ...filters, pillar: e.target.value })}
            className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Start Date From</label>
          <input
            type="date"
            value={filters.date_from}
            onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
            className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">End Date To</label>
          <input
            type="date"
            value={filters.date_to}
            onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
            className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>
      {tab === 'overview' && (
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
            Columns to Include in Export
          </label>
          <div className="flex flex-wrap gap-2">
            {OVERVIEW_COLUMNS.map((col) => (
              <button
                key={col.key}
                onClick={() => toggleColumn(col.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  filters.columns.includes(col.key)
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                }`}
              >
                {col.label}
              </button>
            ))}
          </div>
          {filters.columns.length === 0 && (
            <p className="text-xs text-amber-600 mt-2">Select at least one column, or all columns will be exported.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>('overview');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCustom, setShowCustom] = useState(false);
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);
  const [filters, setFilters] = useState<ExportFilters>({
    status: '', pillar: '', date_from: '', date_to: '',
    columns: OVERVIEW_COLUMNS.map((c) => c.key),
  });

  useEffect(() => {
    setLoading(true);
    setData(null);
    const fetcher = {
      overview: reportAPI.overview,
      budget: reportAPI.budget,
      time: reportAPI.timeTracking,
      team: reportAPI.teamProductivity,
      workload: reportAPI.workload,
    }[tab];
    fetcher().then((r) => { setData(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, [tab]);

  const handleExport = (format: 'excel' | 'pdf') => {
    setExporting(format);
    const payload: Record<string, unknown> = { format, report_type: tab, ...filters };
    reportAPI.export(payload as any).then((r) => {
      const ext = format === 'pdf' ? 'pdf' : 'xlsx';
      const mime = format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const url = window.URL.createObjectURL(new Blob([r.data], { type: mime }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `altel_${tab}_report_${new Date().toISOString().slice(0, 10)}.${ext}`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success(`${format.toUpperCase()} report downloaded`);
    }).catch(() => toast.error('Export failed')).finally(() => setExporting(null));
  };

  const tabs: { key: ReportTab; label: string; icon: typeof TrendingUp }[] = [
    { key: 'overview', label: 'Overview', icon: TrendingUp },
    { key: 'budget', label: 'Budget (RM)', icon: DollarSign },
    { key: 'time', label: 'Time Tracking', icon: Clock },
    { key: 'team', label: 'Team', icon: Users },
    { key: 'workload', label: 'Workload', icon: Activity },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Reports & Analytics</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Generate and export project insights — values in Malaysian Ringgit (RM)
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowCustom((v) => !v)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
              showCustom
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-600 dark:text-indigo-300'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-300'
            }`}
          >
            <Settings2 className="h-4 w-4" />
            Custom Report
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showCustom ? 'rotate-180' : ''}`} />
          </button>
          <button
            onClick={() => handleExport('excel')}
            disabled={exporting !== null}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 shadow-sm hover:shadow transition-all"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {exporting === 'excel' ? 'Exporting…' : 'Export Excel'}
          </button>
          <button
            onClick={() => handleExport('pdf')}
            disabled={exporting !== null}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60 shadow-sm hover:shadow transition-all"
          >
            <FileText className="h-4 w-4" />
            {exporting === 'pdf' ? 'Generating PDF…' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* Custom Report Panel */}
      {showCustom && (
        <CustomReportPanel
          tab={tab}
          filters={filters}
          setFilters={setFilters}
          onClose={() => setShowCustom(false)}
        />
      )}

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
              tab === t.key
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 hover:text-indigo-600'
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {loading ? <LoadingSpinner /> : !data ? (
        <div className="card p-12 text-center">
          <Activity className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">No data available</p>
        </div>
      ) : (
        <ReportContent tab={tab} data={data} />
      )}
    </div>
  );
}

function ReportContent({ tab, data }: { tab: ReportTab; data: any }) {
  if (tab === 'overview') return <OverviewTab data={data} />;
  if (tab === 'budget') return <BudgetTab data={data} />;
  if (tab === 'time') return <TimeTab data={data} />;
  if (tab === 'team') return <TeamTab data={data} />;
  if (tab === 'workload') return <WorkloadTab data={data} />;
  return null;
}

function OverviewTab({ data }: { data: any }) {
  const statusData = data.by_status
    ? Object.entries(data.by_status).filter(([, v]) => (v as number) > 0).map(([name, value]) => ({
        name: name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        value: value as number,
        fill: STATUS_COLORS[name] || '#6366f1',
      }))
    : [];
  const priorityData = data.by_priority
    ? Object.entries(data.by_priority).filter(([, v]) => (v as number) > 0).map(([name, value]) => ({
        name: name.replace(/\b\w/g, (c) => c.toUpperCase()),
        value: value as number,
      }))
    : [];

  const cards = [
    { label: 'Total Projects', value: data.total || 0, icon: FolderKanban, bg: 'bg-indigo-50 dark:bg-indigo-900/30', fg: 'text-indigo-600 dark:text-indigo-400' },
    { label: 'Completed', value: data.by_status?.completed || 0, icon: CheckCircle2, bg: 'bg-emerald-50 dark:bg-emerald-900/30', fg: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'In Progress', value: (data.by_status?.ongoing || 0), icon: TrendingUp, bg: 'bg-blue-50 dark:bg-blue-900/30', fg: 'text-blue-600 dark:text-blue-400' },
    { label: 'Overdue', value: data.overdue || 0, icon: AlertTriangle, bg: 'bg-red-50 dark:bg-red-900/30', fg: 'text-red-600 dark:text-red-400' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-5 hover:shadow-md transition-shadow">
            <div className={`p-2.5 rounded-xl inline-flex ${c.bg} ${c.fg} mb-3`}><c.icon className="h-5 w-5" /></div>
            <p className="text-3xl font-bold text-slate-800 dark:text-white">{c.value}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{c.label}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-base font-semibold text-slate-800 dark:text-white mb-4">Status Distribution</h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={{ stroke: '#94a3b8' }}>
                  {statusData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [v, 'Projects']} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-slate-400 text-center py-12">No data</p>}
        </div>
        <div className="card p-6">
          <h3 className="text-base font-semibold text-slate-800 dark:text-white mb-4">Priority Distribution</h3>
          {priorityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={priorityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 13 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="value" name="Projects" radius={[8, 8, 0, 0]}>
                  {priorityData.map((_, i) => <Cell key={i} fill={['#22c55e', '#eab308', '#f97316', '#ef4444'][i] || COLORS[i]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-slate-400 text-center py-12">No data</p>}
        </div>
      </div>
    </div>
  );
}

function BudgetTab({ data }: { data: any }) {
  const projects = data.projects || [];
  const totals = data.totals || {};
  const cards = [
    { label: 'Total Budget', sublabel: 'Value (RM)', value: totals.total_budget || 0, bg: 'bg-indigo-50 dark:bg-indigo-900/30', fg: 'text-indigo-600 dark:text-indigo-400', icon: DollarSign },
    { label: 'Total Spent', sublabel: 'Value (RM)', value: totals.total_spent || 0, bg: 'bg-rose-50 dark:bg-rose-900/30', fg: 'text-rose-600 dark:text-rose-400', icon: TrendingUp },
    { label: 'Remaining', sublabel: 'Value (RM)', value: totals.total_remaining || 0, bg: 'bg-emerald-50 dark:bg-emerald-900/30', fg: 'text-emerald-600 dark:text-emerald-400', icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-5 hover:shadow-md transition-shadow">
            <div className={`p-2.5 rounded-xl inline-flex ${c.bg} ${c.fg} mb-3`}><c.icon className="h-5 w-5" /></div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">{c.sublabel}</p>
            <p className="text-xl font-bold text-slate-800 dark:text-white">{formatCurrency(c.value)}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{c.label}</p>
          </div>
        ))}
      </div>
      <div className="card p-6">
        <h3 className="text-base font-semibold text-slate-800 dark:text-white mb-1">Budget vs Spent (RM)</h3>
        <p className="text-xs text-slate-400 mb-4">All values in Ringgit Malaysia</p>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={projects.map((p: any) => ({ name: p.title?.length > 18 ? p.title.slice(0, 18) + '…' : p.title, budget: p.budget_total, spent: p.budget_spent }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `RM ${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Bar dataKey="budget" fill="#6366f1" name="Budget (RM)" radius={[6, 6, 0, 0]} />
            <Bar dataKey="spent" fill="#f43f5e" name="Spent (RM)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800 dark:text-white">Project Budget Details</h3>
          <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-full">All values in Ringgit Malaysia (RM)</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
              <th className="px-6 py-3 text-left font-medium">Project</th>
              <th className="px-6 py-3 text-left font-medium">Status</th>
              <th className="px-6 py-3 text-right font-medium">Budget (RM)</th>
              <th className="px-6 py-3 text-right font-medium">Spent (RM)</th>
              <th className="px-6 py-3 text-right font-medium">Remaining (RM)</th>
              <th className="px-6 py-3 text-right font-medium">Usage</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p: any) => (
              <tr key={p.id} className="border-t border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                <td className="px-6 py-3 font-medium text-slate-800 dark:text-white">{p.title}</td>
                <td className="px-6 py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 uppercase tracking-wide">{p.status}</span>
                </td>
                <td className="px-6 py-3 text-right text-slate-600 dark:text-slate-300 font-mono text-xs">{formatCurrency(p.budget_total)}</td>
                <td className="px-6 py-3 text-right text-slate-600 dark:text-slate-300 font-mono text-xs">{formatCurrency(p.budget_spent)}</td>
                <td className={`px-6 py-3 text-right font-mono text-xs font-semibold ${p.is_over_budget ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {formatCurrency(p.budget_remaining)}
                </td>
                <td className="px-6 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-20 bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                      <div className={`h-2 rounded-full ${p.is_over_budget ? 'bg-red-500' : p.budget_usage_pct >= 80 ? 'bg-yellow-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(100, p.budget_usage_pct)}%` }} />
                    </div>
                    <span className={`text-xs font-medium ${p.is_over_budget ? 'text-red-500' : 'text-slate-500'}`}>{p.budget_usage_pct}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-indigo-50 dark:bg-indigo-900/20 border-t-2 border-indigo-200 dark:border-indigo-700">
              <td className="px-6 py-3 font-bold text-slate-800 dark:text-white" colSpan={2}>Total</td>
              <td className="px-6 py-3 text-right font-bold text-slate-800 dark:text-white font-mono text-xs">{formatCurrency(totals.total_budget || 0)}</td>
              <td className="px-6 py-3 text-right font-bold text-slate-800 dark:text-white font-mono text-xs">{formatCurrency(totals.total_spent || 0)}</td>
              <td className="px-6 py-3 text-right font-bold text-emerald-700 dark:text-emerald-400 font-mono text-xs">{formatCurrency(totals.total_remaining || 0)}</td>
              <td className="px-6 py-3 text-right text-xs font-semibold text-slate-500">
                {totals.total_budget > 0 ? `${((totals.total_spent / totals.total_budget) * 100).toFixed(1)}%` : '—'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function TimeTab({ data }: { data: any }) {
  const byProject = (data.by_project || []).map((p: any) => ({ name: p.task__project__title || 'Unknown', hours: parseFloat(p.total_hours || 0) }));
  const byUser = (data.by_user || []).map((u: any) => ({ name: `${u.user__first_name || ''} ${u.user__last_name || ''}`.trim() || u.user__username, hours: parseFloat(u.total_hours || 0) }));
  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"><Clock className="h-6 w-6" /></div>
          <div>
            <p className="text-3xl font-bold text-slate-800 dark:text-white">{(data.total_hours || 0).toFixed(1)}h</p>
            <p className="text-sm text-slate-500">Total Hours Logged (Last 30 days)</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-base font-semibold text-slate-800 dark:text-white mb-4">Hours by Project</h3>
          {byProject.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byProject}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="hours" fill="#8b5cf6" name="Hours" radius={[6, 6, 0, 0]} /></BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart icon={Clock} text="No time logged yet" />}
        </div>
        <div className="card p-6">
          <h3 className="text-base font-semibold text-slate-800 dark:text-white mb-4">Hours by Member</h3>
          {byUser.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byUser} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} /><XAxis type="number" axisLine={false} tickLine={false} /><YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{ fontSize: 12 }} /><Tooltip /><Bar dataKey="hours" fill="#6366f1" name="Hours" radius={[0, 6, 6, 0]} /></BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart icon={Users} text="No time logged yet" />}
        </div>
      </div>
    </div>
  );
}

function TeamTab({ data }: { data: any }) {
  const members = Array.isArray(data) ? data : [data];
  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
        <h3 className="text-base font-semibold text-slate-800 dark:text-white">Team Productivity</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
            <th className="px-6 py-3 text-left font-medium">Member</th>
            <th className="px-6 py-3 text-center font-medium">Assigned</th>
            <th className="px-6 py-3 text-center font-medium">Completed</th>
            <th className="px-6 py-3 text-center font-medium">Overdue</th>
            <th className="px-6 py-3 text-center font-medium">Hours</th>
            <th className="px-6 py-3 text-center font-medium">Rate</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m: any, i: number) => (
            <tr key={i} className="border-t border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-sm font-bold text-white">
                    {(m.full_name || m.username || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-slate-800 dark:text-white">{m.full_name || m.username}</p>
                    <p className="text-xs text-slate-400">@{m.username}</p>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 text-center font-semibold text-slate-700 dark:text-slate-300">{m.tasks_assigned || 0}</td>
              <td className="px-6 py-4 text-center"><span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">{m.tasks_completed || 0}</span></td>
              <td className="px-6 py-4 text-center"><span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${(m.tasks_overdue || 0) > 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-slate-100 text-slate-500'}`}>{m.tasks_overdue || 0}</span></td>
              <td className="px-6 py-4 text-center text-slate-600 dark:text-slate-300">{(m.hours_logged || 0).toFixed(1)}h</td>
              <td className="px-6 py-4 text-center">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-16 bg-slate-200 dark:bg-slate-700 rounded-full h-2"><div className="h-2 rounded-full bg-indigo-500" style={{ width: `${Math.min(100, m.completion_rate || 0)}%` }} /></div>
                  <span className="text-xs font-medium text-slate-500">{(m.completion_rate || 0).toFixed(0)}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {members.length === 0 && <EmptyChart icon={Users} text="No team data" />}
    </div>
  );
}

function WorkloadTab({ data }: { data: any }) {
  const members = Array.isArray(data) ? data : [data];
  const max = Math.max(...members.map((m: any) => m.active_tasks || 0), 1);
  return (
    <div className="card p-6">
      <h3 className="text-base font-semibold text-slate-800 dark:text-white mb-6">Active Tasks per Team Member</h3>
      <div className="space-y-5">
        {members.map((m: any, i: number) => (
          <div key={i} className="flex items-center gap-4">
            <div className="w-36 flex-shrink-0 flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-xs font-bold text-white">
                {(m.full_name || m.username || '?')[0].toUpperCase()}
              </div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{m.full_name || m.username}</span>
            </div>
            <div className="flex-1">
              <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-9 relative overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 flex items-center px-3 ${(m.active_tasks || 0) > 10 ? 'bg-gradient-to-r from-red-500 to-red-400' : (m.active_tasks || 0) > 5 ? 'bg-gradient-to-r from-amber-500 to-amber-400' : 'bg-gradient-to-r from-indigo-500 to-indigo-400'}`} style={{ width: `${Math.max(12, ((m.active_tasks || 0) / max) * 100)}%` }}>
                  <span className="text-xs font-bold text-white">{m.active_tasks} tasks</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {members.length === 0 && <EmptyChart icon={Users} text="No workload data" />}
    </div>
  );
}

function EmptyChart({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return <div className="text-center py-12 text-slate-400"><Icon className="h-10 w-10 mx-auto mb-2 opacity-40" /><p className="text-sm">{text}</p></div>;
}
