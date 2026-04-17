import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardAPI } from '@/api/endpoints';
import { DashboardData } from '@/types';
import { LoadingSpinner, StatusBadge, PriorityBadge, ProgressBar } from '@/components/ui';
import { formatDate, timeAgo } from '@/utils/helpers';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area,
} from 'recharts';
import {
  FolderKanban, CheckCircle2, Clock, AlertTriangle,
  TrendingUp, ListTodo, ArrowRight,
  Activity, Zap, FileEdit, PauseCircle, XCircle,
} from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  Draft: '#94a3b8', Ongoing: '#6366f1',
  'On Hold': '#eab308', Completed: '#22c55e', Cancelled: '#64748b', Expired: '#ef4444',
};

const PRIORITY_COLORS: Record<string, string> = {
  Low: '#22c55e', Medium: '#eab308', High: '#f97316', Critical: '#ef4444',
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    dashboardAPI.get()
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (!data) return <div className="text-center text-slate-500 py-12">Failed to load dashboard</div>;

  const s = data.summary;

  const summaryCards = [
    { label: 'Total Projects', value: s.total_projects, icon: FolderKanban, color: 'from-indigo-500 to-indigo-600', iconBg: 'bg-indigo-400/20', status: '' },
    { label: 'Draft', value: s.draft, icon: FileEdit, color: 'from-slate-500 to-slate-600', iconBg: 'bg-slate-400/20', status: 'DRAFT' },
    { label: 'Ongoing', value: s.ongoing, icon: TrendingUp, color: 'from-blue-500 to-blue-600', iconBg: 'bg-blue-400/20', status: 'ONGOING' },
    { label: 'On Hold', value: s.on_hold, icon: PauseCircle, color: 'from-amber-500 to-amber-600', iconBg: 'bg-amber-400/20', status: 'ON_HOLD' },
    { label: 'Completed', value: s.completed, icon: CheckCircle2, color: 'from-emerald-500 to-emerald-600', iconBg: 'bg-emerald-400/20', status: 'COMPLETED' },
    { label: 'Expired', value: s.expired, icon: XCircle, color: 'from-red-500 to-red-600', iconBg: 'bg-red-400/20', status: 'EXPIRED' },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Welcome back! Here's your project overview.</p>
        </div>
        <button onClick={() => navigate('/projects/new')} className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm">
          <Zap className="h-4 w-4" /> New Project
        </button>
      </div>

      {/* Summary cards - clickable */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {summaryCards.map((c) => (
          <div
            key={c.label}
            onClick={() => navigate(c.status ? `/projects?status=${c.status}` : '/projects')}
            className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${c.color} p-5 text-white shadow-lg cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all duration-200`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-white/80">{c.label}</p>
                <p className="text-3xl font-bold mt-1">{c.value}</p>
              </div>
              <div className={`${c.iconBg} rounded-lg p-2.5`}>
                <c.icon className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-white/5" />
            <div className="absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-white/5" />
            <p className="text-[10px] text-white/60 mt-2">Click to view</p>
          </div>
        ))}
      </div>

      {/* Main row: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status distribution donut */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">Project Status</h3>
          {data.charts.status_distribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={data.charts.status_distribution}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={85}
                  paddingAngle={3} dataKey="value"
                  stroke="none"
                >
                  {data.charts.status_distribution.map((entry, i) => (
                    <Cell key={i} fill={STATUS_COLORS[entry.name] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">No data</div>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2">
            {data.charts.status_distribution.map((d, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[d.name] || '#94a3b8' }} />
                <span className="text-xs text-slate-500 dark:text-slate-400">{d.name} ({d.value})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly completed area chart */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">Monthly Completions</h3>
          {data.charts.monthly_completed.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={data.charts.monthly_completed}>
                <defs>
                  <linearGradient id="gradCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px' }} />
                <Area type="monotone" dataKey="completed" stroke="#6366f1" strokeWidth={2} fill="url(#gradCompleted)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-sm text-slate-400">No data yet</div>
          )}
        </div>
      </div>

      {/* Second row: Priority chart, My Tasks Today, Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Priority distribution */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">Priority Distribution</h3>
          {data.charts.priority_distribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.charts.priority_distribution} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {data.charts.priority_distribution.map((entry, i) => (
                    <Cell key={i} fill={PRIORITY_COLORS[entry.name] || '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">No data</div>
          )}
        </div>

        {/* My Tasks Today */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">My Tasks Today</h3>
            <button onClick={() => navigate('/tasks')} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          {data.my_tasks_today.length > 0 ? (
            <div className="space-y-2.5">
              {data.my_tasks_today.slice(0, 6).map((t) => (
                <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-700/40 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors cursor-pointer" onClick={() => navigate('/tasks')}>
                  <div className="flex-shrink-0">
                    <ListTodo className="h-4 w-4 text-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{t.title}</p>
                  </div>
                  <PriorityBadge priority={t.priority} />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-400 mb-2" />
              <p className="text-sm text-slate-500 dark:text-slate-400">All caught up!</p>
            </div>
          )}
        </div>

        {/* Alerts */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">Alerts</h3>
          <div className="space-y-2.5">
            {data.alerts.items.length > 0 ? (
              data.alerts.items.map((alert) => {
                const severityStyles = {
                  critical: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-100 dark:border-red-900/40', iconColor: 'text-red-500', titleColor: 'text-red-700 dark:text-red-400', msgColor: 'text-red-500/70 dark:text-red-400/60' },
                  urgent: { bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-100 dark:border-orange-900/40', iconColor: 'text-orange-500', titleColor: 'text-orange-700 dark:text-orange-400', msgColor: 'text-orange-500/70 dark:text-orange-400/60' },
                  warning: { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-100 dark:border-amber-900/40', iconColor: 'text-amber-500', titleColor: 'text-amber-700 dark:text-amber-400', msgColor: 'text-amber-500/70 dark:text-amber-400/60' },
                };
                const style = severityStyles[alert.severity];
                const Icon = alert.severity === 'critical' ? AlertTriangle : Clock;

                return (
                  <div
                    key={`${alert.type}-${alert.id}`}
                    onClick={() => navigate(`/projects/${alert.id}`)}
                    className={`flex items-start gap-3 p-3 rounded-lg ${style.bg} border ${style.border} cursor-pointer hover:opacity-90 transition-all`}
                  >
                    <Icon className={`h-5 w-5 ${style.iconColor} flex-shrink-0 mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${style.titleColor} truncate`}>{alert.title}</p>
                      <p className={`text-xs ${style.msgColor} mt-0.5`}>
                        {alert.message} · Deadline: {new Date(alert.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusBadge status={alert.status} />
                        <span className="text-[10px] text-slate-400">{alert.progress}% done</span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-400 mb-2" />
                <p className="text-sm text-slate-500 dark:text-slate-400">No alerts - everything's on track!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom row: Top Projects + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Projects */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Top Projects</h3>
            <button onClick={() => navigate('/projects')} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-3">
            {(data.top_projects || []).slice(0, 5).map((p) => (
              <div
                key={p.id}
                onClick={() => navigate(`/projects/${p.id}`)}
                className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-sm font-bold">{p.title.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{p.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge status={p.status} />
                  </div>
                </div>
                <div className="w-20 flex-shrink-0">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>{p.progress_percent}%</span>
                  </div>
                  <ProgressBar value={p.progress_percent} />
                </div>
              </div>
            ))}
            {(!data.top_projects || data.top_projects.length === 0) && (
              <p className="text-sm text-slate-400 text-center py-4">No projects yet</p>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Recent Activity</h3>
            <Activity className="h-4 w-4 text-slate-400" />
          </div>
          <div className="relative">
            <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-slate-200 dark:bg-slate-700" />
            <div className="space-y-4">
              {(data.recent_activity || []).slice(0, 8).map((a) => (
                <div key={a.id} className="flex gap-3 relative">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0 z-10 ring-4 ring-white dark:ring-slate-800">
                    <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-300">
                      {a.actor?.full_name?.[0] || a.actor?.username?.[0] || '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      <span className="font-medium">{a.actor?.full_name || a.actor?.username || 'System'}</span>
                      {' '}<span className="text-slate-500 dark:text-slate-400">{a.description}</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{timeAgo(a.created_at)}</p>
                  </div>
                </div>
              ))}
              {(!data.recent_activity || data.recent_activity.length === 0) && (
                <p className="text-sm text-slate-400 text-center py-4 relative z-10">No recent activity</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
