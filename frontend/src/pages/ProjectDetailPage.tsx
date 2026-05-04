import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { projectAPI, milestoneAPI, taskAPI, commentAPI, attachmentAPI } from '@/api/endpoints';
import { Project, Milestone, Task, Comment, Attachment, ActivityLog } from '@/types';
import { StatusBadge, PriorityBadge, ProgressBar, LoadingSpinner, Modal, HealthScore } from '@/components/ui';
import { formatDate, timeAgo, formatFileSize, cn } from '@/utils/helpers';
import { useAuthStore } from '@/stores/authStore';
import {
  ArrowLeft, Edit, Clock, FileText,
  MessageSquare, DollarSign, Plus, Send, Paperclip,
  Calendar, User, Building2, Layers, CheckCircle2, AlertTriangle,
  Activity, TrendingUp, ListTodo,
  ExternalLink, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

type Tab = 'overview' | 'milestones' | 'tasks' | 'files' | 'activity' | 'comments';

const STATUS_GRADIENT: Record<string, string> = {
  DRAFT: 'from-slate-400 to-slate-500',
  ONGOING: 'from-indigo-500 to-blue-600',
  ON_HOLD: 'from-amber-400 to-orange-500',
  COMPLETED: 'from-emerald-500 to-green-600',
  CANCELLED: 'from-slate-500 to-slate-600',
  EXPIRED: 'from-red-500 to-rose-600',
};

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const canSeeTCV =
    user?.is_superuser ||
    user?.access_level === 'ADMIN' ||
    user?.access_level === 'FULL_ACCESS' ||
    user?.access_level === 'PILLAR_BASED';

  const [project, setProject] = useState<Project | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');
  const [newComment, setNewComment] = useState('');
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [milestoneForm, setMilestoneForm] = useState({ name: '', description: '', deadline: '' });

  useEffect(() => {
    if (!id) return;
    Promise.all([
      projectAPI.get(id),
      milestoneAPI.list(id),
      taskAPI.list({ project: id }),
      commentAPI.list({ project: id }),
      attachmentAPI.list({ project: id }),
      projectAPI.activity(id),
    ]).then(([pRes, mRes, tRes, cRes, aRes, actRes]) => {
      setProject(pRes.data);
      setMilestones(Array.isArray(mRes.data) ? mRes.data : (mRes.data as any).results || []);
      setTasks(tRes.data.results || tRes.data);
      setComments(cRes.data.results || cRes.data);
      setAttachments(aRes.data.results || aRes.data);
      setActivity(Array.isArray(actRes.data) ? actRes.data : (actRes.data as any).results || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  // Poll project every 60s
  useEffect(() => {
    if (!id) return;
    const interval = setInterval(() => {
      projectAPI.get(id).then((r) => setProject(r.data)).catch(() => {});
    }, 60_000);
    return () => clearInterval(interval);
  }, [id]);

  const handleAddComment = () => {
    if (!newComment.trim() || !id) return;
    commentAPI.create({ project: id, content: newComment }).then((r) => {
      setComments([r.data, ...comments]);
      setNewComment('');
      toast.success('Comment added');
    }).catch(() => toast.error('Failed to add comment'));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('project', id);
    attachmentAPI.upload(fd).then((r) => {
      setAttachments([r.data, ...attachments]);
      toast.success('File uploaded');
    }).catch(() => toast.error('Upload failed'));
  };

  const handleAddMilestone = () => {
    if (!id || !milestoneForm.name) return;
    milestoneAPI.create(id, { ...milestoneForm, project: id }).then((r) => {
      setMilestones([...milestones, r.data]);
      setShowMilestoneModal(false);
      setMilestoneForm({ name: '', description: '', deadline: '' });
      toast.success('Milestone created');
    }).catch(() => toast.error('Failed to create milestone'));
  };

  if (loading) return <LoadingSpinner />;
  if (!project) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <AlertTriangle className="h-12 w-12 text-slate-300" />
      <p className="text-slate-500">Project not found</p>
      <button onClick={() => navigate('/projects')} className="btn-primary px-4 py-2 rounded-lg text-sm">Back to Projects</button>
    </div>
  );

  const gradient = STATUS_GRADIENT[project.status] || 'from-indigo-500 to-blue-600';
  const tasksCompleted = tasks.filter((t) => t.status === 'DONE').length;
  const milestoneDone = milestones.filter((m) => m.status === 'COMPLETED').length;
  const daysLeft = project.days_until_deadline;
  const tcvValue = canSeeTCV ? project.tcv_display : null;

  const tabItems: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'milestones', label: 'Milestones', count: milestones.length },
    { key: 'tasks', label: 'Tasks', count: tasks.length },
    { key: 'files', label: 'Files', count: attachments.length },
    { key: 'comments', label: 'Comments', count: comments.length },
    { key: 'activity', label: 'Activity' },
  ];

  return (
    <div className="space-y-0">

      {/* ── Hero Banner ── */}
      <div className={`relative bg-gradient-to-r ${gradient} rounded-2xl p-6 mb-6 overflow-hidden shadow-lg`}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, white 0%, transparent 60%)' }} />
        <div className="relative">
          <div className="flex items-center gap-1.5 text-white/70 text-xs mb-4">
            <button onClick={() => navigate('/projects')} className="hover:text-white transition-colors">Projects</button>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-white/90 truncate max-w-[200px]">{project.title}</span>
          </div>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              {project.pillar && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white/90 mb-3 backdrop-blur-sm">
                  <Layers className="h-3 w-3" /> {project.pillar}
                </span>
              )}
              <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight mb-3">{project.title}</h1>
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={project.status} />
                <PriorityBadge priority={project.priority} />
                {project.is_overdue && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/30 text-white border border-red-400/50">
                    <AlertTriangle className="h-3 w-3" /> Overdue
                  </span>
                )}
                {daysLeft !== null && daysLeft >= 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white/90">
                    <Clock className="h-3 w-3" />
                    {daysLeft === 0 ? 'Due today' : `${daysLeft}d remaining`}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-white/15 text-white hover:bg-white/25 backdrop-blur-sm transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <button
                onClick={() => navigate(`/projects/${id}/edit`)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-white text-slate-800 hover:bg-white/90 shadow-md transition-colors"
              >
                <Edit className="h-4 w-4" /> Edit
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Progress</span>
            <TrendingUp className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-bold text-slate-800 dark:text-white">{project.progress_percent}%</p>
          <ProgressBar value={project.progress_percent} className="h-1.5 mt-2" />
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Health Score</span>
            <Activity className="h-4 w-4 text-emerald-500" />
          </div>
          <HealthScore score={project.health_score || 0} />
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Tasks Done</span>
            <ListTodo className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-slate-800 dark:text-white">
            {tasksCompleted}<span className="text-sm font-normal text-slate-400">/{tasks.length}</span>
          </p>
          <p className="text-xs text-slate-400 mt-1">completed</p>
        </div>
        {canSeeTCV && tcvValue != null ? (
          <div className="card p-4 border-l-4 border-emerald-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">TCV (RM)</span>
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 leading-tight">
              {Number(tcvValue).toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-slate-400 mt-1">contract value</p>
          </div>
        ) : (
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Milestones</span>
              <CheckCircle2 className="h-4 w-4 text-violet-500" />
            </div>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">
              {milestoneDone}<span className="text-sm font-normal text-slate-400">/{milestones.length}</span>
            </p>
            <p className="text-xs text-slate-400 mt-1">completed</p>
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="border-b border-slate-200 dark:border-slate-700 mb-6">
        <div className="flex gap-0 overflow-x-auto">
          {tabItems.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all flex items-center gap-2',
                tab === t.key
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300'
              )}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={cn(
                  'text-xs rounded-full px-1.5 py-0.5 font-semibold min-w-[20px] text-center',
                  tab === t.key
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                )}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Overview Tab ── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT: Description + Timeline + Custom Fields + Team */}
          <div className="lg:col-span-2 space-y-5">

            {/* Description */}
            <div className="card p-6">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-500" /> Scope of Works / Description
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed">
                {project.description || 'No description provided.'}
              </p>
            </div>

            {/* Timeline */}
            <div className="card p-6">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-violet-500" /> Project Timeline
              </h3>
              <div className="flex items-center gap-4 mb-4">
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Start</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-white">
                    {project.start_date ? formatDate(project.start_date) : '—'}
                  </p>
                </div>
                <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mx-2">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all"
                    style={{ width: `${Math.min(project.progress_percent, 100)}%` }}
                  />
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400 mb-0.5">Deadline</p>
                  <p className={cn('text-sm font-semibold', project.is_overdue ? 'text-red-500' : 'text-slate-800 dark:text-white')}>
                    {project.end_date ? formatDate(project.end_date) : '—'}
                  </p>
                </div>
              </div>
              <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                <span>Overall progress</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">{project.progress_percent}%</span>
              </div>
              <ProgressBar value={project.progress_percent} className="h-2.5" />
            </div>

            {/* Custom Fields */}
            {project.custom_fields && Object.keys(project.custom_fields).length > 0 && (
              <div className="card p-6">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-amber-500" /> Additional Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(project.custom_fields).map(([k, v]) => (
                    <div key={k} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/40 border border-slate-100 dark:border-slate-700">
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">{k}</p>
                      <p className="text-sm font-semibold text-slate-800 dark:text-white">{v || '—'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Team */}
            <div className="card p-6">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                <User className="h-4 w-4 text-blue-500" /> Team Members
              </h3>
              {project.members && project.members.length > 0 ? (
                <div className="space-y-2">
                  {project.members.map((m: any) => (
                    <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-sm font-bold text-white flex-shrink-0 shadow-sm">
                        {(m.user?.first_name?.[0] || m.user?.username?.[0] || '?').toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-white truncate">
                          {m.user?.first_name ? `${m.user.first_name} ${m.user.last_name || ''}`.trim() : m.user?.username}
                        </p>
                        <p className="text-xs text-slate-400">{m.user?.email || ''}</p>
                      </div>
                      <span className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full flex-shrink-0">{m.role_in_project}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No team members assigned</p>
              )}
            </div>
          </div>

          {/* RIGHT: Details panel + Quick Stats */}
          <div className="space-y-5">
            <div className="card p-6">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-slate-500" /> Project Details
              </h3>
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Status</dt>
                  <dd><StatusBadge status={project.status} /></dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Priority</dt>
                  <dd><PriorityBadge priority={project.priority} /></dd>
                </div>
                <div className="border-t border-slate-100 dark:border-slate-700/60 pt-3">
                  {project.pillar && (
                    <div className="flex items-center justify-between mb-3">
                      <dt className="text-slate-500 flex items-center gap-1.5"><Layers className="h-3.5 w-3.5 text-violet-400" /> Pillar</dt>
                      <dd className="text-slate-800 dark:text-white font-medium text-right">{project.pillar}</dd>
                    </div>
                  )}
                  {project.client_name && (
                    <div className="flex items-center justify-between mb-3">
                      <dt className="text-slate-500 flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-blue-400" /> Client</dt>
                      <dd className="text-slate-800 dark:text-white text-right">{project.client_name}</dd>
                    </div>
                  )}
                  {project.project_manager && (
                    <div className="flex items-start justify-between mb-3 gap-2">
                      <dt className="text-slate-500 flex items-center gap-1.5 flex-shrink-0"><User className="h-3.5 w-3.5 text-indigo-400" /> PM</dt>
                      <dd className="text-slate-800 dark:text-white text-right">{project.project_manager}</dd>
                    </div>
                  )}
                </div>
                {/* TCV — visible only to authorised roles, value comes from server */}
                {canSeeTCV && (
                  <div className="border-t border-slate-100 dark:border-slate-700/60 pt-3">
                    {tcvValue != null ? (
                      <div className="flex items-center justify-between">
                        <dt className="text-slate-500 flex items-center gap-1.5">
                          <DollarSign className="h-3.5 w-3.5 text-emerald-500" /> TCV (RM)
                        </dt>
                        <dd className="text-emerald-700 dark:text-emerald-400 font-bold text-right">
                          RM {Number(tcvValue).toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                        </dd>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <dt className="text-slate-500 flex items-center gap-1.5">
                          <DollarSign className="h-3.5 w-3.5 text-slate-400" /> TCV (RM)
                        </dt>
                        <dd className="text-slate-400 text-xs italic">Not set</dd>
                      </div>
                    )}
                  </div>
                )}
                <div className="border-t border-slate-100 dark:border-slate-700/60 pt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-slate-400" /> Start Date</dt>
                    <dd className="text-slate-800 dark:text-white">{project.start_date ? formatDate(project.start_date) : '—'}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-slate-400" /> Deadline</dt>
                    <dd className={cn('font-medium', project.is_overdue ? 'text-red-500' : 'text-slate-800 dark:text-white')}>
                      {project.end_date ? formatDate(project.end_date) : '—'}
                    </dd>
                  </div>
                  {project.actual_completion_date && (
                    <div className="flex items-center justify-between">
                      <dt className="text-slate-500">Completed</dt>
                      <dd className="text-emerald-600 font-medium">{formatDate(project.actual_completion_date)}</dd>
                    </div>
                  )}
                </div>
                <div className="border-t border-slate-100 dark:border-slate-700/60 pt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500">Health Score</dt>
                    <dd><HealthScore score={project.health_score || 0} /></dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500">Created</dt>
                    <dd className="text-slate-800 dark:text-white text-xs">{formatDate(project.created_at)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500">Updated</dt>
                    <dd className="text-slate-500 text-xs">{timeAgo(project.updated_at)}</dd>
                  </div>
                </div>
              </dl>
            </div>

            {/* Quick Stats */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Quick Stats</h3>
              <div className="space-y-3">
                {[
                  { label: 'Tasks done', value: `${tasksCompleted} / ${tasks.length}` },
                  { label: 'Milestones done', value: `${milestoneDone} / ${milestones.length}` },
                  { label: 'Comments', value: String(comments.length) },
                  { label: 'Files', value: String(attachments.length) },
                  { label: 'Team members', value: String(project.members?.length || 0) },
                ].map((stat) => (
                  <div key={stat.label} className="flex justify-between text-sm">
                    <span className="text-slate-500">{stat.label}</span>
                    <span className="font-semibold text-slate-800 dark:text-white">{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Milestones Tab ── */}
      {tab === 'milestones' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">{milestoneDone} of {milestones.length} milestones completed</p>
            <button onClick={() => setShowMilestoneModal(true)} className="btn-primary flex items-center gap-2 px-3 py-2 rounded-lg text-sm">
              <Plus className="h-4 w-4" /> Add Milestone
            </button>
          </div>
          {milestones.length > 0 && (
            <ProgressBar value={(milestoneDone / Math.max(milestones.length, 1)) * 100} className="h-2" />
          )}
          <div className="space-y-3">
            {milestones.map((m) => (
              <div key={m.id} className="card p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className={cn('w-2.5 h-2.5 rounded-full', m.status === 'COMPLETED' ? 'bg-emerald-500' : m.status === 'MISSED' ? 'bg-red-500' : 'bg-amber-400')} />
                      <h4 className="font-semibold text-slate-800 dark:text-white text-sm">{m.title}</h4>
                    </div>
                    {m.description && <p className="text-xs text-slate-500 ml-4">{m.description}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <StatusBadge status={m.status === 'COMPLETED' ? 'COMPLETED' : m.status === 'MISSED' ? 'EXPIRED' : 'ONGOING'} />
                    {m.due_date && <p className="text-xs text-slate-400 mt-1">{formatDate(m.due_date)}</p>}
                  </div>
                </div>
                <ProgressBar value={m.progress_percent || 0} className="h-1.5" />
                <p className="text-xs text-slate-400 mt-1.5">{m.progress_percent || 0}% complete</p>
              </div>
            ))}
          </div>
          {milestones.length === 0 && (
            <div className="card p-12 flex flex-col items-center justify-center text-center gap-3">
              <CheckCircle2 className="h-10 w-10 text-slate-200 dark:text-slate-700" />
              <p className="text-sm text-slate-400">No milestones yet</p>
              <button onClick={() => setShowMilestoneModal(true)} className="btn-primary px-4 py-2 rounded-lg text-sm">Add First Milestone</button>
            </div>
          )}
          <Modal open={showMilestoneModal} onClose={() => setShowMilestoneModal(false)} title="Add Milestone">
            <div className="space-y-3">
              <input placeholder="Milestone name *" value={milestoneForm.name} onChange={(e) => setMilestoneForm({ ...milestoneForm, name: e.target.value })} className="input-field w-full py-2 text-sm" />
              <textarea placeholder="Description (optional)" value={milestoneForm.description} onChange={(e) => setMilestoneForm({ ...milestoneForm, description: e.target.value })} className="input-field w-full py-2 text-sm" rows={2} />
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Deadline</label>
                <input type="date" value={milestoneForm.deadline} onChange={(e) => setMilestoneForm({ ...milestoneForm, deadline: e.target.value })} className="input-field w-full py-2 text-sm" />
              </div>
              <button onClick={handleAddMilestone} className="btn-primary px-4 py-2 rounded-lg text-sm w-full">Create Milestone</button>
            </div>
          </Modal>
        </div>
      )}

      {/* ── Tasks Tab ── */}
      {tab === 'tasks' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">{tasksCompleted} of {tasks.length} tasks completed</p>
            <button onClick={() => navigate(`/tasks?project=${id}`)} className="btn-primary flex items-center gap-2 px-3 py-2 rounded-lg text-sm">
              <Plus className="h-4 w-4" /> Manage Tasks
            </button>
          </div>
          {tasks.map((t) => (
            <div key={t.id} className="card p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', t.status === 'DONE' ? 'bg-emerald-500' : t.status === 'IN_PROGRESS' ? 'bg-indigo-500' : t.status === 'BLOCKED' ? 'bg-red-500' : 'bg-slate-300')} />
                <div className="min-w-0">
                  <p className={cn('text-sm font-medium truncate', t.status === 'DONE' ? 'line-through text-slate-400' : 'text-slate-800 dark:text-white')}>{t.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <StatusBadge status={t.status} />
                    <PriorityBadge priority={t.priority} />
                  </div>
                </div>
              </div>
              {t.due_date && (
                <span className="text-xs text-slate-400 flex-shrink-0 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {formatDate(t.due_date)}
                </span>
              )}
            </div>
          ))}
          {tasks.length === 0 && (
            <div className="card p-12 flex flex-col items-center justify-center text-center gap-3">
              <ListTodo className="h-10 w-10 text-slate-200 dark:text-slate-700" />
              <p className="text-sm text-slate-400">No tasks yet</p>
            </div>
          )}
        </div>
      )}

      {/* ── Files Tab ── */}
      {tab === 'files' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{attachments.length} file{attachments.length !== 1 ? 's' : ''} attached</p>
            <label className="btn-primary flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer">
              <Paperclip className="h-4 w-4" /> Upload File
              <input type="file" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {attachments.map((a) => (
              <div key={a.id} className="card p-4 flex items-center gap-3 group hover:border-indigo-200 dark:hover:border-indigo-700 transition-colors">
                <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-5 w-5 text-indigo-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{a.file_name}</p>
                  <p className="text-xs text-slate-400">{formatFileSize(a.file_size)} · {timeAgo(a.created_at)}</p>
                </div>
                <a href={a.file} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors opacity-0 group-hover:opacity-100">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            ))}
          </div>
          {attachments.length === 0 && (
            <div className="card p-12 flex flex-col items-center justify-center text-center gap-3">
              <Paperclip className="h-10 w-10 text-slate-200 dark:text-slate-700" />
              <p className="text-sm text-slate-400">No files uploaded yet</p>
            </div>
          )}
        </div>
      )}

      {/* ── Comments Tab ── */}
      {tab === 'comments' && (
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-indigo-500" /> Add Comment
            </h3>
            <textarea
              rows={3}
              placeholder="Write a comment or update..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) handleAddComment(); }}
              className="input-field w-full text-sm mb-3 resize-none"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">Ctrl+Enter to submit</p>
              <button onClick={handleAddComment} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm">
                <Send className="h-4 w-4" /> Post
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {comments.map((c) => (
              <div key={c.id} className="card p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                    {(c.author?.full_name?.[0] || '?').toUpperCase()}
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-slate-800 dark:text-white">{c.author?.full_name || 'Unknown'}</span>
                    <span className="text-xs text-slate-400 ml-2">{timeAgo(c.created_at)}</span>
                  </div>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed pl-11">{c.content}</p>
              </div>
            ))}
          </div>
          {comments.length === 0 && (
            <div className="card p-12 flex flex-col items-center justify-center text-center gap-3">
              <MessageSquare className="h-10 w-10 text-slate-200 dark:text-slate-700" />
              <p className="text-sm text-slate-400">No comments yet</p>
            </div>
          )}
        </div>
      )}

      {/* ── Activity Tab ── */}
      {tab === 'activity' && (
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-5 flex items-center gap-2">
            <Activity className="h-4 w-4 text-indigo-500" /> Project Activity Log
          </h3>
          {activity.length > 0 ? (
            <div className="space-y-0">
              {activity.map((a, i) => (
                <div key={a.id} className="flex gap-4 relative">
                  {i < activity.length - 1 && (
                    <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-slate-100 dark:bg-slate-700" />
                  )}
                  <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0 mt-1 z-10">
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  </div>
                  <div className="flex-1 pb-5">
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      <span className="font-semibold">{a.actor?.full_name || 'System'}</span> {a.description}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{timeAgo(a.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Activity className="h-10 w-10 text-slate-200 dark:text-slate-700" />
              <p className="text-sm text-slate-400">No activity recorded yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
