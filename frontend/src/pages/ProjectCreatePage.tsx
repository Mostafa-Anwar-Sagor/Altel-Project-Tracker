import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { projectAPI, pillarAPI, reportAPI } from '@/api/endpoints';
import { Pillar } from '@/types';
import { LoadingSpinner } from '@/components/ui';
import { ArrowLeft, Plus, X, Trash2, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUSES = ['DRAFT', 'ONGOING', 'ON_HOLD', 'COMPLETED', 'CANCELLED', 'EXPIRED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

interface ProjectForm {
  title: string;
  description: string;
  status: string;
  priority: string;
  pillar: string;
  client_name: string;
  project_manager: string;
  start_date: string;
  end_date: string;
  progress_percent: string;
  tcv: string;
}

export default function ProjectCreatePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [newPillarName, setNewPillarName] = useState('');
  const [showNewPillar, setShowNewPillar] = useState(false);
  const [customFields, setCustomFields] = useState<{ key: string; value: string }[]>([]);
  const [importedProjects, setImportedProjects] = useState<Record<string, unknown>[] | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [bulkCreating, setBulkCreating] = useState(false);
  const [createResults, setCreateResults] = useState<Record<number, { status: 'creating' | 'created' | 'failed'; error?: string }>>({});
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [editedProjects, setEditedProjects] = useState<Record<string, unknown>[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<ProjectForm>({
    defaultValues: { status: 'DRAFT', priority: 'MEDIUM', pillar: '', progress_percent: '0', tcv: '' },
  });

  const fetchPillars = () => {
    pillarAPI.list().then((r) => setPillars(r.data)).catch(() => {});
  };

  useEffect(() => {
    fetchPillars();
  }, []);

  useEffect(() => {
    if (!id) return;
    projectAPI.get(id).then((r) => {
      const p = r.data;
      reset({
        title: p.title,
        description: p.description || '',
        status: p.status,
        priority: p.priority,
        pillar: p.pillar || '',
        client_name: p.client_name || '',
        project_manager: p.project_manager || '',
        start_date: p.start_date || '',
        end_date: p.end_date || '',
        progress_percent: p.progress_percent?.toString() || '0',
        tcv: p.tcv != null ? String(p.tcv) : '',
      });
      if (p.custom_fields && typeof p.custom_fields === 'object') {
        setCustomFields(Object.entries(p.custom_fields).map(([key, value]) => ({ key, value: String(value) })));
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id, reset]);

  const handleAddPillar = async () => {
    const name = newPillarName.trim();
    if (!name) return;
    try {
      const r = await pillarAPI.create({ name });
      setPillars((prev) => [...prev, r.data]);
      setValue('pillar', r.data.name);
      setNewPillarName('');
      setShowNewPillar(false);
      toast.success(`Pillar "${name}" added`);
    } catch {
      toast.error('Failed to add pillar');
    }
  };

  const handleDeletePillar = async (pillar: Pillar) => {
    if (!confirm(`Delete pillar "${pillar.name}"? This won't affect existing projects.`)) return;
    try {
      await pillarAPI.delete(pillar.id);
      setPillars((prev) => prev.filter((p) => p.id !== pillar.id));
      toast.success(`Pillar "${pillar.name}" removed`);
    } catch {
      toast.error('Failed to delete pillar');
    }
  };

  const addCustomField = () => {
    setCustomFields((prev) => [...prev, { key: '', value: '' }]);
  };

  const removeCustomField = (index: number) => {
    setCustomFields((prev) => prev.filter((_, i) => i !== index));
  };

  const updateCustomField = (index: number, field: 'key' | 'value', val: string) => {
    setCustomFields((prev) => prev.map((f, i) => (i === index ? { ...f, [field]: val } : f)));
  };

  const onSubmit = async (data: ProjectForm) => {
    setSubmitting(true);
    try {
      const cfObj: Record<string, string> = {};
      customFields.forEach((f) => { if (f.key.trim()) cfObj[f.key.trim()] = f.value; });

      const payload: Record<string, unknown> = {
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        pillar: data.pillar || '',
        client_name: data.client_name || '',
        project_manager: data.project_manager || '',
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        progress_percent: data.progress_percent ? parseInt(data.progress_percent) : 0,
        tcv: data.tcv ? parseFloat(data.tcv) : null,
        custom_fields: cfObj,
      };
      if (isEdit) {
        await projectAPI.update(id!, payload);
        toast.success('Project updated');
      } else {
        await projectAPI.create(payload);
        toast.success('Project created');
      }
      navigate('/projects');
    } catch {
      toast.error('Failed to save project');
    }
    setSubmitting(false);
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await reportAPI.importExcel(fd);
      setImportedProjects(res.data.projects);
      setEditedProjects(res.data.projects.map((p: Record<string, unknown>) => ({ ...p })));
      setShowImportModal(true);
      toast.success(`Detected ${res.data.count} project(s) from Excel`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to parse Excel file';
      toast.error(msg);
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const createOneProject = async (idx: number) => {
    const proj = editedProjects[idx];
    setCreateResults(prev => ({ ...prev, [idx]: { status: 'creating' } }));
    try {
      const res = await reportAPI.bulkCreateExcel([proj]);
      const result = res.data.results[0];
      if (result.status === 'created') {
        setCreateResults(prev => ({ ...prev, [idx]: { status: 'created' } }));
        toast.success(`"${String(proj.title)}" created`);
      } else {
        setCreateResults(prev => ({ ...prev, [idx]: { status: 'failed', error: result.error } }));
        toast.error(`Failed: ${result.error}`);
      }
    } catch {
      setCreateResults(prev => ({ ...prev, [idx]: { status: 'failed', error: 'Network error' } }));
      toast.error('Failed to create project');
    }
  };

  const createAllProjects = async () => {
    if (!importedProjects) return;
    setBulkCreating(true);
    const initial: Record<number, { status: 'creating' }> = {};
    importedProjects.forEach((_, i) => { initial[i] = { status: 'creating' }; });
    setCreateResults(initial);
    try {
      const res = await reportAPI.bulkCreateExcel(editedProjects);
      const data = res.data;
      const next: Record<number, { status: 'created' | 'failed'; error?: string }> = {};
      (data.results as { index: number; status: string; error?: string }[]).forEach(r => {
        next[r.index] = { status: r.status as 'created' | 'failed', error: r.error };
      });
      setCreateResults(next);
      if (data.created > 0) {
        toast.success(`Created ${data.created} of ${data.total} projects!`);
        setTimeout(() => {
          setShowImportModal(false);
          setImportedProjects(null);
          setCreateResults({});
          navigate('/projects');
        }, 1800);
      }
      if (data.failed > 0) {
        toast.error(`${data.failed} project(s) failed to create`);
      }
    } catch {
      toast.error('Bulk creation failed');
    }
    setBulkCreating(false);
  };

  const closeImportModal = () => {
    if (bulkCreating) return;
    setShowImportModal(false);
    setImportedProjects(null);
    setCreateResults({});
    setExpandedIdx(null);
    setEditedProjects([]);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
          <ArrowLeft className="h-5 w-5 text-slate-500" />
        </button>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
          {isEdit ? 'Edit Project' : 'New Project'}
        </h1>
      </div>

      {/* Excel Import — only on create */}
      {!isEdit && (
        <div className="card p-4 border-2 border-dashed border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-900/10">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-8 w-8 text-indigo-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Import from Excel</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Upload an .xlsx file — columns are auto-detected (project name, client, TCV, dates, etc.)</p>
              </div>
            </div>
            <label className="btn-primary px-4 py-2 rounded-lg text-sm flex items-center gap-2 cursor-pointer flex-shrink-0">
              {importLoading ? 'Parsing...' : <><Upload className="h-4 w-4" /> Upload Excel</>}
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelImport} disabled={importLoading} />
            </label>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="card p-6 space-y-5">
        {/* Pillar */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Pillar *</label>
          <div className="flex gap-2">
            <select {...register('pillar', { required: 'Pillar is required' })} className="input-field flex-1 py-2 text-sm">
              <option value="">Select Pillar</option>
              {pillars.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
            <button type="button" onClick={() => setShowNewPillar(!showNewPillar)} className="btn-secondary px-3 py-2 rounded-lg text-sm flex items-center gap-1 whitespace-nowrap">
              <Plus className="h-4 w-4" /> New
            </button>
          </div>
          {showNewPillar && (
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={newPillarName}
                onChange={(e) => setNewPillarName(e.target.value)}
                placeholder="Enter new pillar name"
                className="input-field flex-1 py-2 text-sm"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddPillar(); } }}
                autoFocus
              />
              <button type="button" onClick={handleAddPillar} className="btn-primary px-3 py-2 rounded-lg text-sm">Add</button>
              <button type="button" onClick={() => { setShowNewPillar(false); setNewPillarName(''); }} className="btn-secondary px-3 py-2 rounded-lg text-sm">Cancel</button>
            </div>
          )}
          {errors.pillar && <p className="text-xs text-red-500 mt-1">{errors.pillar.message}</p>}
          {/* Manage existing pillars */}
          {pillars.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {pillars.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                  {p.name}
                  <button type="button" onClick={() => handleDeletePillar(p)} className="ml-0.5 p-0.5 rounded-full hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors" title={`Remove ${p.name}`}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Client Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Client Name *</label>
            <input {...register('client_name', { required: 'Client name is required' })} className="input-field w-full py-2 text-sm" placeholder="e.g. PETRONAS" />
            {errors.client_name && <p className="text-xs text-red-500 mt-1">{errors.client_name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Project Manager</label>
            <input {...register('project_manager')} className="input-field w-full py-2 text-sm" placeholder="Project manager name" />
          </div>
        </div>

        {/* Project Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Project Name *</label>
          <input {...register('title', { required: 'Project name is required' })} className="input-field w-full py-2 text-sm" />
          {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}
        </div>

        {/* Scope of Works */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Brief Description / Scope of Works</label>
          <textarea {...register('description')} rows={4} className="input-field w-full py-2 text-sm" placeholder="Describe the scope of works..." />
        </div>

        {/* Status & Priority */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
            <select {...register('status')} className="input-field w-full py-2 text-sm">
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Priority</label>
            <select {...register('priority')} className="input-field w-full py-2 text-sm">
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        {/* Year / Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Start Date</label>
            <input type="date" {...register('start_date')} className="input-field w-full py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">End Date</label>
            <input type="date" {...register('end_date')} className="input-field w-full py-2 text-sm" />
          </div>
        </div>

        {/* Completed % */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Completed (%)</label>
            <input type="number" min="0" max="100" {...register('progress_percent')} className="input-field w-full py-2 text-sm" placeholder="0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Total Contract Value — TCV (RM)
              <span className="ml-1.5 text-xs font-normal text-slate-400">(optional)</span>
            </label>
            <input type="number" step="0.01" min="0" {...register('tcv')} className="input-field w-full py-2 text-sm" placeholder="e.g. 500000.00" />
          </div>
        </div>

        {/* Custom Fields */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Additional Information</label>
            <button type="button" onClick={addCustomField} className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
              <Plus className="h-3.5 w-3.5" /> Add Info
            </button>
          </div>
          {customFields.length === 0 && (
            <p className="text-xs text-slate-400">No additional info. Click "Add Info" to add PO number, region, notes, etc.</p>
          )}
          <div className="space-y-2">
            {customFields.map((cf, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                <input
                  type="text"
                  value={cf.key}
                  onChange={(e) => updateCustomField(idx, 'key', e.target.value)}
                  placeholder="e.g. PO Number, Region, Remark"
                  className="input-field py-2 text-sm w-full"
                />
                <input
                  type="text"
                  value={cf.value}
                  onChange={(e) => updateCustomField(idx, 'value', e.target.value)}
                  placeholder="e.g. PO-12345, Northern, Urgent delivery"
                  className="input-field py-2 text-sm w-full"
                />
                <button type="button" onClick={() => removeCustomField(idx)} className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Remove this field">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={submitting} className="btn-primary px-6 py-2.5 rounded-lg text-sm flex-1">
            {submitting ? 'Saving...' : isEdit ? 'Update Project' : 'Create Project'}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary px-6 py-2.5 rounded-lg text-sm">
            Cancel
          </button>
        </div>
      </form>

      {/* Excel Import Preview Modal */}
      {showImportModal && importedProjects && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-indigo-500" />
                <div>
                  <h2 className="text-base font-bold text-slate-800 dark:text-white">Excel Import — {importedProjects.length} Project{importedProjects.length !== 1 ? 's' : ''} Detected</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Projects will be created instantly. Unknown columns saved as custom fields.</p>
                </div>
              </div>
              <button onClick={closeImportModal} disabled={bulkCreating} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40">
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>

            {/* Project List */}
            <div className="overflow-y-auto flex-1 p-4 space-y-2">
              {importedProjects.map((proj, idx) => {
                const result = createResults[idx];
                const isCreating = result?.status === 'creating';
                const isCreated = result?.status === 'created';
                const isFailed = result?.status === 'failed';
                const ep = editedProjects[idx] || proj;
                const customFieldKeys = ep.custom_fields && typeof ep.custom_fields === 'object'
                  ? Object.keys(ep.custom_fields as Record<string, unknown>)
                  : [];
                const isExpanded = expandedIdx === idx;

                const updateField = (field: string, value: string) => {
                  setEditedProjects(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
                };

                return (
                  <div
                    key={idx}
                    className={`rounded-xl border transition-colors ${
                      isCreated
                        ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20'
                        : isFailed
                        ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
                        : isExpanded
                        ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/40'
                    }`}
                  >
                    {/* Summary row */}
                    <div className="flex items-start justify-between gap-3 p-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{String(ep.title) || '(No title)'}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {ep.pillar && <span>Pillar: {String(ep.pillar)}</span>}
                          {ep.client_name && <span>Client: {String(ep.client_name)}</span>}
                          {ep.project_manager && <span>PM: {String(ep.project_manager)}</span>}
                          {ep.tcv != null && ep.tcv !== '' && <span className="text-emerald-600 dark:text-emerald-400 font-medium">TCV: RM {Number(ep.tcv).toLocaleString()}</span>}
                          {ep.start_date && <span>Start: {String(ep.start_date)}</span>}
                          {ep.end_date && <span>End: {String(ep.end_date)}</span>}
                          <span className="capitalize">{String(ep.status || 'draft').toLowerCase().replace(/_/g, ' ')}</span>
                          {customFieldKeys.length > 0 && (
                            <span className="text-violet-500 dark:text-violet-400">+{customFieldKeys.length} custom field{customFieldKeys.length !== 1 ? 's' : ''}</span>
                          )}
                        </div>
                        {isFailed && result.error && (
                          <p className="text-xs text-red-500 mt-1">{result.error}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {!isCreated && !isCreating && (
                          <button
                            onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                            disabled={bulkCreating}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-40"
                          >
                            {isExpanded ? 'Collapse' : 'Edit'}
                          </button>
                        )}
                        {isCreated ? (
                          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-medium px-3 py-1.5">
                            <CheckCircle className="h-3.5 w-3.5" /> Created
                          </div>
                        ) : isFailed ? (
                          <div className="flex items-center gap-1 text-red-500 text-xs font-medium px-3 py-1.5">
                            <AlertCircle className="h-3.5 w-3.5" /> Failed
                          </div>
                        ) : isCreating ? (
                          <div className="flex items-center gap-1 text-indigo-500 text-xs font-medium px-3 py-1.5">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating...
                          </div>
                        ) : (
                          <button
                            onClick={() => createOneProject(idx)}
                            disabled={bulkCreating}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Plus className="h-3.5 w-3.5" /> Create
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Inline edit form (expanded) */}
                    {isExpanded && !isCreated && (
                      <div className="px-3 pb-4 border-t border-indigo-200 dark:border-indigo-700/50 pt-3 space-y-3">
                        <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-2">Edit project data before creating</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Project Name</label>
                            <input type="text" value={String(ep.title || '')} onChange={(e) => updateField('title', e.target.value)} className="input-field w-full py-1.5 text-xs" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Pillar</label>
                            <input type="text" value={String(ep.pillar || '')} onChange={(e) => updateField('pillar', e.target.value)} className="input-field w-full py-1.5 text-xs" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Client Name</label>
                            <input type="text" value={String(ep.client_name || '')} onChange={(e) => updateField('client_name', e.target.value)} className="input-field w-full py-1.5 text-xs" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Project Manager</label>
                            <input type="text" value={String(ep.project_manager || '')} onChange={(e) => updateField('project_manager', e.target.value)} className="input-field w-full py-1.5 text-xs" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Status</label>
                            <select value={String(ep.status || 'DRAFT')} onChange={(e) => updateField('status', e.target.value)} className="input-field w-full py-1.5 text-xs">
                              {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Priority</label>
                            <select value={String(ep.priority || 'MEDIUM')} onChange={(e) => updateField('priority', e.target.value)} className="input-field w-full py-1.5 text-xs">
                              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Start Date</label>
                            <input type="date" value={String(ep.start_date || '')} onChange={(e) => updateField('start_date', e.target.value)} className="input-field w-full py-1.5 text-xs" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">End Date</label>
                            <input type="date" value={String(ep.end_date || '')} onChange={(e) => updateField('end_date', e.target.value)} className="input-field w-full py-1.5 text-xs" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Progress (%)</label>
                            <input type="number" min="0" max="100" value={String(ep.progress_percent || 0)} onChange={(e) => updateField('progress_percent', e.target.value)} className="input-field w-full py-1.5 text-xs" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">TCV (RM)</label>
                            <input type="number" min="0" step="0.01" value={String(ep.tcv || '')} onChange={(e) => updateField('tcv', e.target.value)} className="input-field w-full py-1.5 text-xs" placeholder="e.g. 500000" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Description</label>
                          <textarea rows={2} value={String(ep.description || '')} onChange={(e) => updateField('description', e.target.value)} className="input-field w-full py-1.5 text-xs resize-none" placeholder="Scope of works..." />
                        </div>
                        <div className="flex justify-end pt-1">
                          <button
                            onClick={() => setExpandedIdx(null)}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700"
                          >
                            Save &amp; Collapse
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {Object.values(createResults).filter(r => r.status === 'created').length > 0 && (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    {Object.values(createResults).filter(r => r.status === 'created').length} created
                    {Object.values(createResults).filter(r => r.status === 'failed').length > 0 && ` · ${Object.values(createResults).filter(r => r.status === 'failed').length} failed`}
                  </span>
                )}
                {Object.values(createResults).length === 0 && 'Click "Create" on individual rows or use "Create All".'}
              </div>
              <button
                onClick={createAllProjects}
                disabled={bulkCreating || importedProjects.every((_, i) => createResults[i]?.status === 'created')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              >
                {bulkCreating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</>
                ) : (
                  <><CheckCircle className="h-4 w-4" /> Create All {importedProjects.length} Projects</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
