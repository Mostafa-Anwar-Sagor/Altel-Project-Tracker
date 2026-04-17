import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { taskAPI, projectAPI } from '@/api/endpoints';
import { Task, Project } from '@/types';
import { PriorityBadge, LoadingSpinner, EmptyState, Modal } from '@/components/ui';
import { formatDate, cn } from '@/utils/helpers';
import {
  Plus, LayoutGrid, List, Search, ListTodo, ChevronDown,
  Calendar, User, Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';

const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED'];

const STATUS_META: Record<string, { label: string; color: string; dot: string; bg: string }> = {
  TODO: { label: 'Todo', color: 'border-t-slate-400', dot: 'bg-slate-400', bg: 'bg-slate-50 dark:bg-slate-800/40' },
  IN_PROGRESS: { label: 'In Progress', color: 'border-t-blue-500', dot: 'bg-blue-500', bg: 'bg-blue-50/50 dark:bg-blue-900/10' },
  IN_REVIEW: { label: 'In Review', color: 'border-t-amber-500', dot: 'bg-amber-500', bg: 'bg-amber-50/50 dark:bg-amber-900/10' },
  DONE: { label: 'Done', color: 'border-t-emerald-500', dot: 'bg-emerald-500', bg: 'bg-emerald-50/50 dark:bg-emerald-900/10' },
  BLOCKED: { label: 'Blocked', color: 'border-t-red-500', dot: 'bg-red-500', bg: 'bg-red-50/50 dark:bg-red-900/10' },
};

export default function TasksPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const projectFilter = searchParams.get('project') || '';
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'board'>('board');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [project, setProject] = useState(projectFilter);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', status: 'TODO', priority: 'MEDIUM', project: projectFilter, due_date: '' });

  const fetchTasks = () => {
    setLoading(true);
    const params: any = {};
    if (search) params.search = search;
    if (status) params.status = status;
    if (project) params.project = project;
    taskAPI.list(params).then((r) => { setTasks(r.data.results || r.data); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => {
    projectAPI.list({ page_size: '100' }).then((r) => setProjects(r.data.results || r.data)).catch(() => {});
  }, []);

  useEffect(() => { fetchTasks(); }, [search, status, project]);

  const handleCreate = () => {
    if (!form.title || !form.project) { toast.error('Title and project are required'); return; }
    taskAPI.create(form as any).then(() => {
      toast.success('Task created');
      setShowCreate(false);
      setForm({ title: '', description: '', status: 'TODO', priority: 'MEDIUM', project: project, due_date: '' });
      fetchTasks();
    }).catch(() => toast.error('Failed to create task'));
  };

  const handleStatusChange = (taskId: string, newStatus: string) => {
    taskAPI.update(taskId, { status: newStatus }).then(() => {
      setTasks(tasks.map((t) => t.id === taskId ? { ...t, status: newStatus as any } : t));
      toast.success('Status updated');
    }).catch(() => toast.error('Failed to update'));
  };

  const projectMap = new Map(projects.map((p) => [p.id, p.title]));

  const taskStats = {
    total: tasks.length,
    todo: tasks.filter((t) => t.status === 'TODO').length,
    inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
    done: tasks.filter((t) => t.status === 'DONE').length,
    overdue: tasks.filter((t) => t.is_overdue).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Tasks</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {taskStats.total} total · {taskStats.inProgress} in progress · {taskStats.done} done
            {taskStats.overdue > 0 && <span className="text-red-500"> · {taskStats.overdue} overdue</span>}
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm shadow-lg shadow-indigo-500/20">
          <Plus className="h-4 w-4" /> New Task
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search tasks..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-10 py-2.5 w-full text-sm" />
          </div>
          <div className="relative">
            <select value={project} onChange={(e) => setProject(e.target.value)} className="input-field py-2.5 pr-8 text-sm appearance-none cursor-pointer">
              <option value="">All Projects</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="input-field py-2.5 pr-8 text-sm appearance-none cursor-pointer">
              <option value="">All Statuses</option>
              {TASK_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s]?.label || s}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>
          <div className="flex border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <button onClick={() => setView('list')} className={cn('p-2.5 transition-colors', view === 'list' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50')}>
              <List className="h-4 w-4" />
            </button>
            <button onClick={() => setView('board')} className={cn('p-2.5 transition-colors', view === 'board' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50')}>
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {loading ? <LoadingSpinner /> : tasks.length === 0 ? (
        <EmptyState icon={ListTodo} title="No tasks found" description="Create your first task to get started" />
      ) : view === 'board' ? (
        <BoardView tasks={tasks} onStatusChange={handleStatusChange} projectMap={projectMap} />
      ) : (
        <ListView tasks={tasks} onStatusChange={handleStatusChange} projectMap={projectMap} navigate={navigate} />
      )}

      {/* Create Task Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create New Task" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title *</label>
            <input placeholder="Enter task title..." value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input-field w-full py-2.5 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
            <textarea placeholder="Task details..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field w-full py-2.5 text-sm" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Project *</label>
              <select value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} className="input-field py-2.5 text-sm w-full">
                <option value="">Select Project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Priority</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="input-field py-2.5 text-sm w-full">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Due Date</label>
            <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="input-field w-full py-2.5 text-sm" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowCreate(false)} className="btn-secondary flex-1 py-2.5 rounded-lg text-sm">Cancel</button>
            <button onClick={handleCreate} className="btn-primary flex-1 py-2.5 rounded-lg text-sm">Create Task</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function BoardView({ tasks, onStatusChange, projectMap }: { tasks: Task[]; onStatusChange: (id: string, status: string) => void; projectMap: Map<string, string> }) {
  const columns = TASK_STATUSES.map((s) => ({
    status: s,
    meta: STATUS_META[s],
    items: tasks.filter((t) => t.status === s),
  }));

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((col) => (
        <div key={col.status} className="min-w-[280px] w-[280px] flex-shrink-0">
          <div className={cn('border-t-2 mb-3', col.meta.color)}>
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2">
                <span className={cn('w-2 h-2 rounded-full', col.meta.dot)} />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{col.meta.label}</span>
              </div>
              <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full font-medium">
                {col.items.length}
              </span>
            </div>
          </div>
          <div className="space-y-2.5">
            {col.items.map((t) => (
              <TaskCard key={t.id} task={t} onStatusChange={onStatusChange} projectMap={projectMap} />
            ))}
            {col.items.length === 0 && (
              <div className={cn('rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 p-6 text-center', col.meta.bg)}>
                <p className="text-xs text-slate-400">No tasks</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function TaskCard({ task, onStatusChange, projectMap }: { task: Task; onStatusChange: (id: string, status: string) => void; projectMap: Map<string, string> }) {
  const projectTitle = projectMap.get(task.project) || '';

  return (
    <div className="card p-3.5 group hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all">
      {/* Project label */}
      {projectTitle && (
        <p className="text-[10px] font-medium text-indigo-500 dark:text-indigo-400 uppercase tracking-wider mb-1.5">{projectTitle}</p>
      )}

      {/* Title */}
      <p className="text-sm font-medium text-slate-800 dark:text-white leading-snug mb-2">{task.title}</p>

      {/* Meta row */}
      <div className="flex items-center gap-2 mb-2.5">
        <PriorityBadge priority={task.priority} />
        {task.is_overdue && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium">Overdue</span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-slate-700/50">
        <div className="flex items-center gap-3">
          {task.due_date && (
            <span className={cn('flex items-center gap-1 text-xs', task.is_overdue ? 'text-red-500' : 'text-slate-400')}>
              <Calendar className="h-3 w-3" /> {formatDate(task.due_date)}
            </span>
          )}
          {task.assigned_to?.length > 0 && (
            <div className="flex -space-x-1.5">
              {task.assigned_to.slice(0, 3).map((u) => (
                <div key={u.id} className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center ring-2 ring-white dark:ring-slate-800" title={u.full_name || u.username}>
                  <span className="text-[8px] font-semibold text-indigo-600 dark:text-indigo-300">{(u.full_name || u.username).charAt(0)}</span>
                </div>
              ))}
              {task.assigned_to.length > 3 && (
                <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center ring-2 ring-white dark:ring-slate-800">
                  <span className="text-[8px] font-medium text-slate-500">+{task.assigned_to.length - 3}</span>
                </div>
              )}
            </div>
          )}
        </div>
        <select
          value={task.status}
          onChange={(e) => { e.stopPropagation(); onStatusChange(task.id, e.target.value); }}
          className="text-xs bg-transparent text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
        >
          {TASK_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s]?.label || s}</option>)}
        </select>
      </div>
    </div>
  );
}

function ListView({ tasks, onStatusChange, projectMap, navigate }: { tasks: Task[]; onStatusChange: (id: string, status: string) => void; projectMap: Map<string, string>; navigate: any }) {
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500 dark:text-slate-400 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
            <th className="px-5 py-3.5 font-medium">Task</th>
            <th className="px-4 py-3.5 font-medium">Status</th>
            <th className="px-4 py-3.5 font-medium">Priority</th>
            <th className="px-4 py-3.5 font-medium">Due Date</th>
            <th className="px-4 py-3.5 font-medium">Project</th>
            <th className="px-4 py-3.5 font-medium">Assignees</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
          {tasks.map((t) => (
            <tr key={t.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors group">
              <td className="px-5 py-3.5">
                <p className="font-medium text-slate-800 dark:text-white">{t.title}</p>
                {t.subtasks_count > 0 && (
                  <p className="text-[10px] text-slate-400 mt-0.5">{t.subtasks_done}/{t.subtasks_count} subtasks</p>
                )}
              </td>
              <td className="px-4 py-3.5">
                <select
                  value={t.status}
                  onChange={(e) => onStatusChange(t.id, e.target.value)}
                  className={cn('text-xs font-medium rounded-full px-2.5 py-1 border-0 cursor-pointer',
                    t.status === 'TODO' ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400' :
                    t.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' :
                    t.status === 'IN_REVIEW' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' :
                    t.status === 'DONE' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' :
                    'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                  )}
                >
                  {TASK_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s]?.label || s}</option>)}
                </select>
              </td>
              <td className="px-4 py-3.5"><PriorityBadge priority={t.priority} /></td>
              <td className="px-4 py-3.5">
                <span className={cn('text-sm', t.is_overdue ? 'text-red-500 font-medium' : 'text-slate-500 dark:text-slate-400')}>
                  {t.due_date ? formatDate(t.due_date) : '—'}
                </span>
                {t.is_overdue && <p className="text-[10px] text-red-400">Overdue</p>}
              </td>
              <td className="px-4 py-3.5">
                <span className="text-sm text-slate-600 dark:text-slate-300">{projectMap.get(t.project) || '—'}</span>
              </td>
              <td className="px-4 py-3.5">
                {t.assigned_to?.length > 0 ? (
                  <div className="flex -space-x-1.5">
                    {t.assigned_to.slice(0, 3).map((u) => (
                      <div key={u.id} className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center ring-2 ring-white dark:ring-slate-800" title={u.full_name || u.username}>
                        <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-300">{(u.full_name || u.username).charAt(0)}</span>
                      </div>
                    ))}
                    {t.assigned_to.length > 3 && (
                      <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center ring-2 ring-white dark:ring-slate-800">
                        <span className="text-[9px] font-medium text-slate-500">+{t.assigned_to.length - 3}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">Unassigned</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
