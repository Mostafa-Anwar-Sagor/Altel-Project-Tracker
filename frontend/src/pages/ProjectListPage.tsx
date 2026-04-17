import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { projectAPI, pillarAPI } from '@/api/endpoints';
import { Project, Pillar } from '@/types';
import { StatusBadge, ProgressBar, LoadingSpinner, EmptyState, ConfirmDialog } from '@/components/ui';
import { cn } from '@/utils/helpers';
import {
  Plus, LayoutGrid, List, Search, Trash2, Edit2,
  FolderKanban, ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';

const STATUSES = ['DRAFT', 'ONGOING', 'ON_HOLD', 'COMPLETED', 'CANCELLED', 'EXPIRED'];

const PILLAR_COLORS: Record<string, string> = {
  'Managed Network Services': 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'Cybersecurity': 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  'IoT': 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  'Cloud': 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  'PLTE': 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};

const STATUS_COLUMN_COLORS: Record<string, string> = {
  DRAFT: 'border-t-slate-400',
  ONGOING: 'border-t-indigo-500',
  ON_HOLD: 'border-t-amber-500',
  COMPLETED: 'border-t-emerald-500',
  CANCELLED: 'border-t-slate-500',
  EXPIRED: 'border-t-red-500',
};

const STATUS_DOT_COLORS: Record<string, string> = {
  DRAFT: 'bg-slate-400',
  ONGOING: 'bg-indigo-500',
  ON_HOLD: 'bg-amber-500',
  COMPLETED: 'bg-emerald-500',
  CANCELLED: 'bg-slate-500',
  EXPIRED: 'bg-red-500',
};

export default function ProjectListPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'table' | 'kanban'>('table');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pillarFilter, setPillarFilter] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    pillarAPI.list().then((r) => setPillars(r.data)).catch(() => {});
  }, []);

  // Read initial status filter from URL query params
  useEffect(() => {
    const urlStatus = searchParams.get('status');
    if (urlStatus && STATUSES.includes(urlStatus)) {
      setStatusFilter(urlStatus);
    }
  }, [searchParams]);

  const fetchProjects = () => {
    setLoading(true);
    const params: any = {};
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;
    if (pillarFilter) params.pillar = pillarFilter;
    projectAPI.list(params).then((r) => {
      setProjects(r.data.results || r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchProjects(); }, [search, statusFilter, pillarFilter]);

  const handleDelete = () => {
    if (!deleteId) return;
    projectAPI.delete(deleteId).then(() => {
      toast.success('Project deleted');
      setDeleteId(null);
      fetchProjects();
    }).catch(() => toast.error('Failed to delete'));
  };

  const stats = {
    total: projects.length,
    draft: projects.filter((p) => p.status === 'DRAFT').length,
    ongoing: projects.filter((p) => p.status === 'ONGOING').length,
    on_hold: projects.filter((p) => p.status === 'ON_HOLD').length,
    completed: projects.filter((p) => p.status === 'COMPLETED').length,
    expired: projects.filter((p) => p.status === 'EXPIRED').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Projects</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {stats.total} total · {stats.ongoing} ongoing · {stats.completed} completed{stats.expired > 0 ? ` · ${stats.expired} expired` : ''}
          </p>
        </div>
        <button onClick={() => navigate('/projects/new')} className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm shadow-lg shadow-indigo-500/20">
          <Plus className="h-4 w-4" /> New Project
        </button>
      </div>

      {/* Status quick-filter cards */}
      <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { key: '', label: 'All', count: stats.total, color: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700', active: 'ring-2 ring-indigo-500' },
          { key: 'DRAFT', label: 'Draft', count: stats.draft, color: 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-600', active: 'ring-2 ring-slate-500' },
          { key: 'ONGOING', label: 'Ongoing', count: stats.ongoing, color: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800', active: 'ring-2 ring-indigo-500' },
          { key: 'ON_HOLD', label: 'On Hold', count: stats.on_hold, color: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800', active: 'ring-2 ring-amber-500' },
          { key: 'COMPLETED', label: 'Completed', count: stats.completed, color: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800', active: 'ring-2 ring-emerald-500' },
          { key: 'EXPIRED', label: 'Expired', count: stats.expired, color: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800', active: 'ring-2 ring-red-500' },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => setStatusFilter(s.key)}
            className={cn(
              'border rounded-xl p-3 text-left transition-all hover:shadow-md cursor-pointer',
              s.color,
              statusFilter === s.key && s.active
            )}
          >
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{s.count}</p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Filters bar */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10 py-2.5 w-full text-sm"
            />
          </div>
          <div className="relative">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field py-2.5 pr-8 text-sm appearance-none cursor-pointer">
              <option value="">All Statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select value={pillarFilter} onChange={(e) => setPillarFilter(e.target.value)} className="input-field py-2.5 pr-8 text-sm appearance-none cursor-pointer">
              <option value="">All Pillars</option>
              {pillars.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>
          <div className="flex border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <button onClick={() => setView('table')} className={cn('p-2.5 transition-colors', view === 'table' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50')}>
              <List className="h-4 w-4" />
            </button>
            <button onClick={() => setView('kanban')} className={cn('p-2.5 transition-colors', view === 'kanban' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50')}>
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {loading ? <LoadingSpinner /> : projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects found"
          description="Create your first project to get started"
          action={
            <button onClick={() => navigate('/projects/new')} className="btn-primary px-4 py-2 rounded-lg text-sm">
              <Plus className="h-4 w-4 inline mr-1" /> New Project
            </button>
          }
        />
      ) : view === 'table' ? (
        <SpreadsheetView projects={projects} onDelete={setDeleteId} navigate={navigate} />
      ) : (
        <KanbanView projects={projects} navigate={navigate} />
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Project"
        message="Are you sure? This will permanently delete the project and all its data."
        confirmLabel="Delete"
      />
    </div>
  );
}

function SpreadsheetView({ projects, onDelete, navigate }: {
  projects: Project[]; onDelete: (id: string) => void; navigate: any;
}) {
  // Collect all unique custom field keys across all projects
  const customFieldKeys = Array.from(
    new Set(projects.flatMap((p) => (p.custom_fields ? Object.keys(p.custom_fields) : [])))
  );

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 dark:text-slate-400 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
              <th className="px-4 py-3.5 font-semibold text-center w-12">No.</th>
              <th className="px-4 py-3.5 font-semibold">Pillar</th>
              <th className="px-4 py-3.5 font-semibold">Client Name</th>
              <th className="px-4 py-3.5 font-semibold">Contact Person</th>
              <th className="px-4 py-3.5 font-semibold">Tel.</th>
              <th className="px-4 py-3.5 font-semibold">Project Name</th>
              <th className="px-4 py-3.5 font-semibold">Scope of Works</th>
              <th className="px-4 py-3.5 font-semibold">Status</th>
              <th className="px-4 py-3.5 font-semibold">Year</th>
              <th className="px-4 py-3.5 font-semibold text-center">Completed (%)</th>
              {customFieldKeys.map((key) => (
                <th key={key} className="px-4 py-3.5 font-semibold">{key}</th>
              ))}
              <th className="px-4 py-3.5 font-semibold w-20 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {projects.map((p, idx) => (
              <tr
                key={p.id}
                className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 cursor-pointer transition-colors group"
                onClick={() => navigate(`/projects/${p.id}`)}
              >
                <td className="px-4 py-3 text-center text-slate-500 font-medium">{idx + 1}</td>
                <td className="px-4 py-3">
                  {p.pillar ? (
                    <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', PILLAR_COLORS[p.pillar] || 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300')}>
                      {p.pillar}
                    </span>
                  ) : (
                    <span className="text-slate-400 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">{p.client_name || '—'}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{p.contact_person || '—'}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">{p.contact_tel || '—'}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{p.title}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-slate-600 dark:text-slate-400 text-xs">{p.description || '—'}</p>
                </td>
                <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap text-xs">
                  {p.start_date || p.end_date ? (
                    <>
                      <div>{p.start_date ? new Date(p.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}</div>
                      <div className="text-slate-400">to</div>
                      <div>{p.end_date ? new Date(p.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}</div>
                    </>
                  ) : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <ProgressBar value={p.progress_percent} className="flex-1 h-1.5" />
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 w-8 text-right">{p.progress_percent}%</span>
                  </div>
                </td>
                {customFieldKeys.map((key) => (
                  <td key={key} className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs">
                    {p.custom_fields?.[key] || '—'}
                  </td>
                ))}
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1 justify-center">
                    <button
                      onClick={() => navigate(`/projects/${p.id}/edit`)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => onDelete(p.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KanbanView({ projects, navigate }: { projects: Project[]; navigate: any }) {
  const columns = STATUSES.map((status) => ({
    status,
    label: status.replace(/_/g, ' '),
    items: projects.filter((p) => p.status === status),
  })).filter((col) => col.items.length > 0 || ['DRAFT', 'ONGOING', 'COMPLETED'].includes(col.status));

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((col) => (
        <div key={col.status} className="min-w-[300px] w-[300px] flex-shrink-0">
          <div className={cn('flex items-center justify-between mb-3 pb-2 border-t-2', STATUS_COLUMN_COLORS[col.status] || 'border-t-slate-400')}>
            <div className="flex items-center gap-2 mt-3">
              <span className={cn('w-2 h-2 rounded-full', STATUS_DOT_COLORS[col.status] || 'bg-slate-400')} />
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">{col.label}</span>
            </div>
            <span className="mt-3 text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full font-medium">
              {col.items.length}
            </span>
          </div>
          <div className="space-y-3">
            {col.items.map((p) => (
              <div
                key={p.id}
                onClick={() => navigate(`/projects/${p.id}`)}
                className="card p-4 cursor-pointer hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all group"
              >
                {p.pillar && (
                  <span className={cn('inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium mb-2', PILLAR_COLORS[p.pillar] || 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300')}>
                    {p.pillar}
                  </span>
                )}
                <p className="text-sm font-medium text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-snug">{p.title}</p>
                {p.client_name && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{p.client_name}</p>
                )}

                <ProgressBar value={p.progress_percent} className="mt-3" />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-slate-400">{p.progress_percent}% complete</span>
                  {p.end_date && (
                    <span className={cn('text-xs', p.is_overdue ? 'text-red-500 font-medium' : 'text-slate-400')}>
                      {new Date(p.end_date).getFullYear()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
