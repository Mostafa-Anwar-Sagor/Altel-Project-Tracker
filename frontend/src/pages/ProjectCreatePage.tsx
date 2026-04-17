import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { projectAPI, pillarAPI } from '@/api/endpoints';
import { Pillar } from '@/types';
import { LoadingSpinner } from '@/components/ui';
import { ArrowLeft, Plus, X, Trash2 } from 'lucide-react';
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
  contact_person: string;
  contact_tel: string;
  start_date: string;
  end_date: string;
  progress_percent: string;
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

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<ProjectForm>({
    defaultValues: { status: 'DRAFT', priority: 'MEDIUM', pillar: '', progress_percent: '0' },
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
        contact_person: p.contact_person || '',
        contact_tel: p.contact_tel || '',
        start_date: p.start_date || '',
        end_date: p.end_date || '',
        progress_percent: p.progress_percent?.toString() || '0',
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
        contact_person: data.contact_person || '',
        contact_tel: data.contact_tel || '',
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        progress_percent: data.progress_percent ? parseInt(data.progress_percent) : 0,
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Client Name *</label>
            <input {...register('client_name', { required: 'Client name is required' })} className="input-field w-full py-2 text-sm" placeholder="e.g. PETRONAS" />
            {errors.client_name && <p className="text-xs text-red-500 mt-1">{errors.client_name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Contact Person</label>
            <input {...register('contact_person')} className="input-field w-full py-2 text-sm" placeholder="Contact person name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tel.</label>
            <input {...register('contact_tel')} className="input-field w-full py-2 text-sm" placeholder="e.g. +60123456789" />
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
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Completed (%)</label>
          <input type="number" min="0" max="100" {...register('progress_percent')} className="input-field w-full py-2 text-sm" placeholder="0" />
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
    </div>
  );
}
