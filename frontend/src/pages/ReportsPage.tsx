import { useEffect, useState } from 'react';
import { reportAPI } from '@/api/endpoints';
import { LoadingSpinner } from '@/components/ui';
import { formatCurrency } from '@/utils/helpers';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
  LineChart, Line, ReferenceLine,
} from 'recharts';
import {
  TrendingUp, DollarSign, Users, Clock,
  FolderKanban, AlertTriangle, CheckCircle2, Activity,
  FileText, FileSpreadsheet, Settings2, X, ChevronDown,
  Target, Layers, BarChart2, Zap,
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
  { key: 'tcv', label: 'TCV (RM)' },
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
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [showCustom, setShowCustom] = useState(false);
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);
  const [filters, setFilters] = useState<ExportFilters>({
    status: '', pillar: '', date_from: '', date_to: '',
    columns: OVERVIEW_COLUMNS.map((c) => c.key),
  });

  useEffect(() => {
    let cancelled = false;

    const load = (silent = false) => {
      if (!silent) { setLoading(true); setData(null); }
      const fetcher = {
        overview: reportAPI.overview,
        budget: reportAPI.budget,
        time: reportAPI.timeTracking,
        team: reportAPI.teamProductivity,
        workload: reportAPI.workload,
      }[tab];
      fetcher()
        .then((r) => { if (!cancelled) { setData(r.data); setLastRefresh(new Date()); } })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
    };

    load();
    // Auto-refresh every 60 s so live metrics (overdue, progress, etc.) stay current
    const timer = setInterval(() => load(true), 60_000);
    return () => { cancelled = true; clearInterval(timer); };
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
    { key: 'budget', label: 'TCV (RM)', icon: DollarSign },
    { key: 'time', label: 'Time Tracking', icon: Clock },
    { key: 'team', label: 'Team', icon: Users },
    { key: 'workload', label: 'Workload', icon: Activity },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Project Intelligence</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Data-driven insights and analytics — all values in Malaysian Ringgit (RM)
            <span className="ml-3 inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
              Live · updated {lastRefresh.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })}
            </span>
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

  const pillarData: { pillar: string; count: number }[] = data.by_pillar || [];
  const monthData: { month: string; count: number }[] = data.by_month_created || [];

  const ongoingCount = data.by_status?.ongoing || 0;
  const completedCount = data.by_status?.completed || 0;
  const onHoldCount = data.by_status?.['on_hold'] || 0;
  const draftCount = data.by_status?.draft || 0;

  const cards = [
    {
      label: 'Total Projects', value: data.total || 0,
      sub: `${draftCount} draft · ${onHoldCount} on hold`,
      icon: FolderKanban,
      gradient: 'from-indigo-500 to-indigo-600',
    },
    {
      label: 'Active / Ongoing', value: ongoingCount,
      sub: `${((ongoingCount / Math.max(data.total, 1)) * 100).toFixed(0)}% of portfolio`,
      icon: Zap,
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      label: 'Completed', value: completedCount,
      sub: `${data.completion_rate ?? 0}% completion rate`,
      icon: CheckCircle2,
      gradient: 'from-emerald-500 to-green-500',
    },
    {
      label: 'Avg Progress', value: `${data.avg_progress ?? 0}%`,
      sub: 'across active projects',
      icon: Target,
      gradient: 'from-violet-500 to-purple-600',
    },
    {
      label: 'Expired / Overdue', value: data.overdue || 0,
      sub: 'past end date, not completed',
      icon: AlertTriangle,
      gradient: 'from-red-500 to-rose-500',
    },
    {
      label: 'Pillars', value: pillarData.length || 0,
      sub: pillarData.slice(0, 2).map((p) => p.pillar).join(' · ') || 'No pillar data',
      icon: Layers,
      gradient: 'from-amber-500 to-orange-500',
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-5 hover:shadow-md transition-shadow relative overflow-hidden">
            <div className={`absolute inset-0 bg-gradient-to-br ${c.gradient} opacity-5`} />
            <div className={`p-2.5 rounded-xl inline-flex bg-gradient-to-br ${c.gradient} text-white mb-3 shadow-sm`}>
              <c.icon className="h-4 w-4" />
            </div>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{c.value}</p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">{c.label}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts row 1: Status donut + Priority bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="h-4 w-4 text-indigo-500" />
            <h3 className="text-base font-semibold text-slate-800 dark:text-white">Status Distribution</h3>
          </div>
          {statusData.length > 0 ? (
            <div className="flex flex-col items-center gap-4">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={65} outerRadius={100} dataKey="value"
                    paddingAngle={3}>
                    {statusData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [v, 'Projects']} contentStyle={{ borderRadius: '10px', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center text-xs">
                {statusData.map((s) => (
                  <div key={s.name} className="flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: s.fill }} />
                    <span className="text-slate-600 dark:text-slate-300">{s.name}</span>
                    <span className="font-semibold text-slate-800 dark:text-white">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <p className="text-sm text-slate-400 text-center py-12">No data</p>}
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-violet-500" />
            <h3 className="text-base font-semibold text-slate-800 dark:text-white">Priority Distribution</h3>
          </div>
          {priorityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={priorityData} barSize={36}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 13 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '10px', fontSize: '12px' }} />
                <Bar dataKey="value" name="Projects" radius={[8, 8, 0, 0]}>
                  {priorityData.map((_, i) => <Cell key={i} fill={['#22c55e', '#eab308', '#f97316', '#ef4444'][i] || COLORS[i]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-slate-400 text-center py-12">No data</p>}
        </div>
      </div>

      {/* Charts row 2: Pillar breakdown + Monthly intake trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="h-4 w-4 text-amber-500" />
            <h3 className="text-base font-semibold text-slate-800 dark:text-white">Projects by Pillar</h3>
          </div>
          {pillarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={pillarData} layout="vertical" barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis dataKey="pillar" type="category" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={110} />
                <Tooltip contentStyle={{ borderRadius: '10px', fontSize: '12px' }} />
                <Bar dataKey="count" name="Projects" radius={[0, 6, 6, 0]}>
                  {pillarData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex flex-col items-center justify-center text-center gap-2">
              <Layers className="h-10 w-10 text-slate-200 dark:text-slate-700" />
              <p className="text-sm text-slate-400">No pillar data</p>
              <p className="text-xs text-slate-300 dark:text-slate-600">Assign pillars to projects to see breakdown</p>
            </div>
          )}
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <h3 className="text-base font-semibold text-slate-800 dark:text-white">Project Intake Trend</h3>
            <span className="text-xs text-slate-400 ml-auto">projects created per month (rolling 12 months)</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <defs>
                <linearGradient id="intakeDotGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#22c55e" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <Tooltip
                contentStyle={{ borderRadius: '10px', fontSize: '12px' }}
                formatter={(v: number) => [v, 'Projects Created']}
              />
              <ReferenceLine y={0} stroke="transparent" />
              <Line
                type="monotone"
                dataKey="count"
                name="Projects Created"
                stroke="#22c55e"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#22c55e', stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 7, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                isAnimationActive
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function BudgetTab({ data: initialData }: { data: any }) {
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedPillar, setSelectedPillar] = useState<string>('');
  const [budgetData, setBudgetData] = useState<any>(initialData);
  const [fetching, setFetching] = useState(false);

  const availableYears: string[] = Array.from(
    new Set((budgetData?.by_year || []).map((r: any) => String(r.year)))
  );
  const availablePillars: string[] = Array.from(
    new Set((budgetData?.projects || []).map((p: any) => p.pillar).filter(Boolean))
  ) as string[];

  const fetchWithFilters = (year: string) => {
    setFetching(true);
    const params: Record<string, string> = {};
    if (year) params.year = year;
    reportAPI.budget(params)
      .then((r) => setBudgetData(r.data))
      .catch(() => {})
      .finally(() => setFetching(false));
  };

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    fetchWithFilters(year);
  };

  // FIXED data mapping: backend sends { month: 'Jan', tcv: 0.0 } and { year: '2025', tcv: 0.0 }
  const byYear = (budgetData?.by_year || []).map((r: any) => ({
    year: String(r.year),
    tcv: parseFloat(r.tcv ?? 0),
  }));
  const byMonth = (budgetData?.by_month || []).map((r: any) => ({
    month: String(r.month),
    tcv: parseFloat(r.tcv ?? 0),
  }));
  const byPillar = (budgetData?.by_pillar || []).map((r: any) => ({
    pillar: r.pillar || 'Other',
    tcv: parseFloat(r.tcv ?? 0),
  })).filter((r: any) => !selectedPillar || r.pillar === selectedPillar);

  const totals = budgetData?.totals || {};
  const allProjects: any[] = budgetData?.projects || [];
  const filteredProjects = selectedPillar
    ? allProjects.filter((p: any) => p.pillar === selectedPillar)
    : allProjects;
  const filteredTcv = filteredProjects.reduce((s: number, p: any) => s + (p.tcv || 0), 0);
  const displayTcv = selectedPillar ? filteredTcv : (totals.total_tcv || 0);

  const PILLAR_COLORS_CHART = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

  return (
    <div className="space-y-6">
      {/* ── Filter bar ── */}
      <div className="card p-4 border border-indigo-100 dark:border-indigo-900/40 bg-gradient-to-r from-indigo-50/60 to-white dark:from-indigo-900/10 dark:to-slate-900">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Filter by:</span>

          {/* Year pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => handleYearChange('')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                !selectedYear ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
              }`}
            >All Years</button>
            {availableYears.map((y) => (
              <button
                key={y}
                onClick={() => handleYearChange(y)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  selectedYear === y ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                }`}
              >{y}</button>
            ))}
          </div>

          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 hidden sm:block" />

          {/* Pillar dropdown */}
          <select
            value={selectedPillar}
            onChange={(e) => setSelectedPillar(e.target.value)}
            className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Pillars</option>
            {availablePillars.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>

          {fetching && <span className="text-xs text-indigo-500 animate-pulse font-medium">Loading…</span>}
          {selectedYear && (
            <span className="text-xs text-indigo-700 dark:text-indigo-300 font-semibold bg-indigo-100 dark:bg-indigo-900/40 px-2.5 py-1 rounded-full">
              Monthly view: {selectedYear}
            </span>
          )}
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: 'TOTAL CONTRACT VALUE (RM)', sub: selectedPillar ? `${selectedPillar} pillar` : 'All projects with TCV', value: displayTcv, currency: true, bg: 'from-indigo-500 to-indigo-600', icon: DollarSign },
          { label: 'PROJECTS IN REPORT SCOPE', sub: selectedPillar ? `${selectedPillar} pillar` : 'All tracked projects', value: totals.projects_total || 0, bg: 'from-slate-500 to-slate-600', icon: FolderKanban },
        ].map((c) => (
          <div key={c.label} className={`rounded-2xl bg-gradient-to-br ${c.bg} p-5 text-white shadow-lg relative overflow-hidden`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-1">{c.label}</p>
                <p className="text-2xl font-bold">
                  {c.currency ? formatCurrency(c.value as number) : c.value}
                </p>
                <p className="text-sm text-white/70 mt-0.5">{c.sub}</p>
              </div>
              <div className="bg-white/15 rounded-xl p-2.5"><c.icon className="h-5 w-5 text-white" /></div>
            </div>
            <div className="absolute -bottom-4 -right-4 h-20 w-20 rounded-full bg-white/5" />
          </div>
        ))}
      </div>

      {/* ── TCV by Year bar chart ── */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-semibold text-slate-800 dark:text-white">TCV by Year (RM)</h3>
          <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full uppercase tracking-wide">Click a year pill above to drill down →</span>
        </div>
        <p className="text-xs text-slate-400 mb-5">Total contract value grouped by project start year</p>
        {byYear.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byYear} barSize={52}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 13, fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `RM ${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: number) => [formatCurrency(v), 'TCV']}
                labelStyle={{ fontWeight: 700 }}
                contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '13px' }}
              />
              <Bar dataKey="tcv" name="TCV (RM)" radius={[8, 8, 0, 0]}>
                {byYear.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex flex-col items-center justify-center text-slate-400">
            <DollarSign className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-sm">No TCV data yet — add TCV values to your projects</p>
          </div>
        )}
      </div>

      {/* ── TCV by Pillar horizontal bar ── */}
      <div className="card p-6">
        <h3 className="text-base font-semibold text-slate-800 dark:text-white mb-1">TCV by Pillar (RM)</h3>
        <p className="text-xs text-slate-400 mb-5">Contract value distribution per business pillar</p>
        {byPillar.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(180, byPillar.length * 56)}>
            <BarChart data={byPillar} layout="vertical" barSize={24}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `RM ${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="pillar" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={160} />
              <Tooltip
                formatter={(v: number) => [formatCurrency(v), 'TCV']}
                contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '13px' }}
              />
              <Bar dataKey="tcv" name="TCV (RM)" radius={[0, 8, 8, 0]}>
                {byPillar.map((_: any, i: number) => <Cell key={i} fill={PILLAR_COLORS_CHART[i % PILLAR_COLORS_CHART.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-28 flex items-center justify-center text-sm text-slate-400">No pillar data available for this selection</div>
        )}
      </div>

      {/* ── Project TCV Detail Table ── */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-white">Project TCV Details</h3>
            {(selectedYear || selectedPillar) && (
              <p className="text-xs text-indigo-500 mt-0.5">Filtered: {[selectedYear && `Year ${selectedYear}`, selectedPillar].filter(Boolean).join(' · ')}</p>
            )}
          </div>
          <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-full">All values in Ringgit Malaysia (RM)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">
                <th className="px-5 py-3 text-left font-semibold">Project</th>
                <th className="px-5 py-3 text-left font-semibold">Pillar</th>
                <th className="px-5 py-3 text-left font-semibold">Status</th>
                <th className="px-5 py-3 text-right font-semibold">Progress</th>
                <th className="px-5 py-3 text-right font-semibold">TCV (RM)</th>
                <th className="px-5 py-3 text-right font-semibold">Year</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((p: any) => (
                <tr key={p.id} className="border-t border-slate-100 dark:border-slate-700/50 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10 transition-colors">
                  <td className="px-5 py-3 font-medium text-slate-800 dark:text-white max-w-xs truncate">{p.title}</td>
                  <td className="px-5 py-3">
                    <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md">{p.pillar || '—'}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 uppercase tracking-wider">{p.status}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${p.progress_percent ?? 0}%` }} />
                      </div>
                      <span className="text-xs text-slate-500 w-8 text-right">{p.progress_percent ?? 0}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {p.tcv != null ? formatCurrency(p.tcv) : <span className="text-slate-300 font-normal">—</span>}
                  </td>
                  <td className="px-5 py-3 text-right text-slate-400 text-xs">{p.start_date ? new Date(p.start_date).getFullYear() : '—'}</td>
                </tr>
              ))}
              {filteredProjects.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400 text-sm">No projects match the current filters</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-indigo-50 dark:bg-indigo-900/20 border-t-2 border-indigo-200 dark:border-indigo-700">
                <td className="px-5 py-3 font-bold text-slate-800 dark:text-white text-sm" colSpan={4}>
                  Total {selectedPillar ? `(${selectedPillar})` : ''}
                </td>
                <td className="px-5 py-3 text-right font-bold text-indigo-700 dark:text-indigo-300 font-mono">
                  {formatCurrency(filteredTcv || totals.total_tcv || 0)}
                </td>
                <td className="px-5 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
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
