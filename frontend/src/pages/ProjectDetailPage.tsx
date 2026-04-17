import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { projectAPI, milestoneAPI, taskAPI, commentAPI, attachmentAPI } from '@/api/endpoints';
import { Project, Milestone, Task, Comment, Attachment, ActivityLog } from '@/types';
import { StatusBadge, PriorityBadge, ProgressBar, LoadingSpinner, Modal, HealthScore } from '@/components/ui';
import { formatDate, formatDateTime, timeAgo, formatFileSize, cn } from '@/utils/helpers';
import {
  ArrowLeft, Edit, Clock, Users, Target, FileText,
  MessageSquare, AlertTriangle, DollarSign, Plus, Send, Paperclip,
} from 'lucide-react';
import toast from 'react-hot-toast';

type Tab = 'overview' | 'milestones' | 'tasks' | 'files' | 'activity' | 'comments';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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

  if (loading) return <LoadingSpinner />;
  if (!project) return <p className="text-center text-slate-400 py-12">Project not found</p>;

  const tabItems: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'milestones', label: `Milestones (${milestones.length})` },
    { key: 'tasks', label: `Tasks (${tasks.length})` },
    { key: 'files', label: `Files (${attachments.length})` },
    { key: 'comments', label: `Comments (${comments.length})` },
    { key: 'activity', label: 'Activity' },
  ];

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
    const formData = new FormData();
    formData.append('file', file);
    formData.append('project', id);
    attachmentAPI.upload(formData).then((r) => {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <button onClick={() => navigate('/projects')} className="mt-1 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
            <ArrowLeft className="h-5 w-5 text-slate-500" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{project.title}</h1>
            <div className="flex items-center gap-3 mt-1">
              <StatusBadge status={project.status} />
              <PriorityBadge priority={project.priority} />
              {project.end_date && (
                <span className="text-sm text-slate-500 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> {formatDate(project.end_date)}
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={() => navigate(`/projects/${id}/edit`)}
          className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
        >
          <Edit className="h-4 w-4" /> Edit
        </button>
      </div>

      {/* Progress */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-500 dark:text-slate-400">Overall Progress</span>
          <span className="text-sm font-semibold text-slate-800 dark:text-white">{project.progress_percent}%</span>
        </div>
        <ProgressBar value={project.progress_percent} className="h-3" />
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <div className="flex gap-1 overflow-x-auto">
          {tabItems.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                tab === t.key
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Description</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                {project.description || 'No description provided.'}
              </p>
            </div>
          </div>
          <div className="space-y-6">
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Details</h3>
              <dl className="space-y-2.5 text-sm">
                {project.pillar && (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Pillar</dt>
                    <dd className="text-slate-800 dark:text-white font-medium">{project.pillar}</dd>
                  </div>
                )}
                {project.client_name && (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Client</dt>
                    <dd className="text-slate-800 dark:text-white">{project.client_name}</dd>
                  </div>
                )}
                {project.contact_person && (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Contact Person</dt>
                    <dd className="text-slate-800 dark:text-white">{project.contact_person}</dd>
                  </div>
                )}
                {project.contact_tel && (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Tel.</dt>
                    <dd className="text-slate-800 dark:text-white">{project.contact_tel}</dd>
                  </div>
                )}
                {project.custom_fields && Object.keys(project.custom_fields).length > 0 && (
                  <>
                    {Object.entries(project.custom_fields).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <dt className="text-slate-500">{k}</dt>
                        <dd className="text-slate-800 dark:text-white">{v}</dd>
                      </div>
                    ))}
                  </>
                )}
                <div className="flex justify-between">
                  <dt className="text-slate-500">Health Score</dt>
                  <dd><HealthScore score={project.health_score || 0} /></dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Created</dt>
                  <dd className="text-slate-800 dark:text-white">{formatDate(project.created_at)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Start Date</dt>
                  <dd className="text-slate-800 dark:text-white">{project.start_date ? formatDate(project.start_date) : '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Deadline</dt>
                  <dd className="text-slate-800 dark:text-white">{project.end_date ? formatDate(project.end_date) : '—'}</dd>
                </div>
              </dl>
            </div>
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Team</h3>
              <div className="space-y-2">
                {project.members?.map((m: any) => (
                  <div key={m.id} className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-xs font-semibold text-indigo-600 dark:text-indigo-300">
                      {m.user?.first_name?.[0] || m.user?.username?.[0] || '?'}
                    </div>
                    <span className="text-sm text-slate-700 dark:text-slate-300">{m.user?.first_name || m.user?.username}</span>
                    <span className="text-xs text-slate-400 ml-auto">{m.role_in_project}</span>
                  </div>
                ))}
                {(!project.members || project.members.length === 0) && (
                  <p className="text-sm text-slate-400">No team members</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'milestones' && (
        <div className="space-y-4">
          <button onClick={() => setShowMilestoneModal(true)} className="btn-primary flex items-center gap-2 px-3 py-2 rounded-lg text-sm">
            <Plus className="h-4 w-4" /> Add Milestone
          </button>
          {milestones.map((m) => (
            <div key={m.id} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                    <h4 className="font-medium text-slate-800 dark:text-white">{m.title}</h4>
                    <p className="text-xs text-slate-400">{m.due_date ? formatDate(m.due_date) : 'No deadline'}</p>
                  </div>
                  <StatusBadge status={m.status === 'COMPLETED' ? 'COMPLETED' : 'ONGOING'} />
              </div>
              <ProgressBar value={m.progress_percent || 0} />
              <p className="text-xs text-slate-400 mt-1">{m.progress_percent || 0}% complete</p>
            </div>
          ))}
          {milestones.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No milestones yet</p>}
          <Modal open={showMilestoneModal} onClose={() => setShowMilestoneModal(false)} title="Add Milestone">
            <div className="space-y-3">
              <input placeholder="Name" value={milestoneForm.name} onChange={(e) => setMilestoneForm({ ...milestoneForm, name: e.target.value })} className="input-field w-full py-2 text-sm" />
              <textarea placeholder="Description" value={milestoneForm.description} onChange={(e) => setMilestoneForm({ ...milestoneForm, description: e.target.value })} className="input-field w-full py-2 text-sm" rows={2} />
              <input type="date" value={milestoneForm.deadline} onChange={(e) => setMilestoneForm({ ...milestoneForm, deadline: e.target.value })} className="input-field w-full py-2 text-sm" />
              <button onClick={handleAddMilestone} className="btn-primary px-4 py-2 rounded-lg text-sm w-full">Create</button>
            </div>
          </Modal>
        </div>
      )}

      {tab === 'tasks' && (
        <div className="space-y-3">
          <button onClick={() => navigate(`/tasks?project=${id}`)} className="btn-primary flex items-center gap-2 px-3 py-2 rounded-lg text-sm">
            <Plus className="h-4 w-4" /> Manage Tasks
          </button>
          {tasks.map((t) => (
            <div key={t.id} className="card p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-white">{t.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={t.status} />
                  <PriorityBadge priority={t.priority} />
                </div>
              </div>
              {t.due_date && <span className="text-xs text-slate-400">{formatDate(t.due_date)}</span>}
            </div>
          ))}
          {tasks.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No tasks yet</p>}
        </div>
      )}

      {tab === 'files' && (
        <div className="space-y-4">
          <label className="btn-secondary flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer w-fit">
            <Paperclip className="h-4 w-4" /> Upload File
            <input type="file" className="hidden" onChange={handleFileUpload} />
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {attachments.map((a) => (
              <div key={a.id} className="card p-3 flex items-center gap-3">
                <FileText className="h-8 w-8 text-slate-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{a.file_name}</p>
                  <p className="text-xs text-slate-400">{formatFileSize(a.file_size)} &bull; {timeAgo(a.created_at)}</p>
                </div>
                <a href={a.file} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline">Open</a>
              </div>
            ))}
          </div>
          {attachments.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No files uploaded</p>}
        </div>
      )}

      {tab === 'comments' && (
        <div className="space-y-4">
          <div className="card p-4">
            <textarea
              rows={3}
              placeholder="Write a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="input-field w-full text-sm mb-3"
            />
            <button onClick={handleAddComment} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm">
              <Send className="h-4 w-4" /> Post Comment
            </button>
          </div>
          {comments.map((c) => (
            <div key={c.id} className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-7 w-7 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-xs font-semibold text-indigo-600 dark:text-indigo-300">
                    {c.author?.full_name?.[0] || '?'}
                  </div>
                  <span className="text-sm font-medium text-slate-800 dark:text-white">{c.author?.full_name || 'Unknown'}</span>
                <span className="text-xs text-slate-400">{timeAgo(c.created_at)}</span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{c.content}</p>
            </div>
          ))}
          {comments.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No comments yet</p>}
        </div>
      )}

      {tab === 'activity' && (
        <div className="card p-5">
          <div className="space-y-4">
            {activity.map((a) => (
              <div key={a.id} className="flex gap-3 border-b border-slate-100 dark:border-slate-700/50 pb-3 last:border-0">
                <div className="w-2 h-2 mt-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
                <div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    <span className="font-medium">{a.actor?.full_name || 'System'}</span> {a.description}
                  </p>
                  <p className="text-xs text-slate-400">{timeAgo(a.created_at)}</p>
                </div>
              </div>
            ))}
            {activity.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No activity yet</p>}
          </div>
        </div>
      )}
    </div>
  );
}
