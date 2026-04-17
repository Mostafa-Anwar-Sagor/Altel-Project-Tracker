import { useState, useEffect } from 'react';
import { authAPI, pillarAPI } from '@/api/endpoints';
import type { User, RoleType } from '@/types';
import { Users, Plus, Trash2, KeyRound, X, Shield, Tag, Settings2, UserCog } from 'lucide-react';
import toast from 'react-hot-toast';

const ACCESS_COLORS: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  FULL_ACCESS: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  PILLAR_BASED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  OWN_ONLY: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

const ACCESS_LABELS: Record<string, string> = {
  ADMIN: 'Admin – Full platform',
  FULL_ACCESS: 'Full Access – All projects',
  PILLAR_BASED: 'Pillar Based – By pillar',
  OWN_ONLY: 'Own Only – Own projects',
};

type TabKey = 'users' | 'roles' | 'pillars';

export default function UserManagementPage() {
  const [tab, setTab] = useState<TabKey>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<RoleType[]>([]);
  const [pillars, setPillars] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [uRes, rRes, pRes] = await Promise.all([
        authAPI.getUsers(),
        authAPI.getRoles(),
        pillarAPI.list(),
      ]);
      setUsers(Array.isArray(uRes.data) ? uRes.data : (uRes.data as any).results || []);
      setRoles(Array.isArray(rRes.data) ? rRes.data : []);
      setPillars(Array.isArray(pRes.data) ? pRes.data : []);
    } catch {
      toast.error('Failed to load data');
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const tabs: { key: TabKey; label: string; icon: typeof Users; count: number }[] = [
    { key: 'users', label: 'Users', icon: Users, count: users.length },
    { key: 'roles', label: 'Roles', icon: Shield, count: roles.length },
    { key: 'pillars', label: 'Pillars', icon: Tag, count: pillars.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
          <Settings2 className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">User Management Panel</h1>
          <p className="text-sm text-slate-500">Manage users, roles & pillars</p>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              tab === t.key ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600' : 'bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400'
            }`}>{t.count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : (
        <>
          {tab === 'users' && <UsersTab users={users} roles={roles} pillars={pillars} onRefresh={fetchAll} />}
          {tab === 'roles' && <RolesTab roles={roles} onRefresh={fetchAll} />}
          {tab === 'pillars' && <PillarsTab pillars={pillars} onRefresh={fetchAll} />}
        </>
      )}
    </div>
  );
}

/* ========== USERS TAB ========== */
function UsersTab({ users, roles, pillars, onRefresh }: { users: User[]; roles: RoleType[]; pillars: { id: number; name: string }[]; onRefresh: () => void }) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState<User | null>(null);
  const [showChangeRoleModal, setShowChangeRoleModal] = useState<User | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<User | null>(null);

  const handleDelete = async (user: User) => {
    try {
      await authAPI.deleteUser(user.id);
      toast.success(`User "${user.username}" deleted`);
      setDeleteConfirm(null);
      onRefresh();
    } catch {
      toast.error('Failed to delete user');
    }
  };

  return (
    <>
      <div className="flex justify-end">
        <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm">
          <Plus className="h-4 w-4" /> Create User
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">User</th>
              <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Role</th>
              <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Access</th>
              <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Pillar</th>
              <th className="text-left p-3 text-xs font-semibold text-slate-500 uppercase">Email</th>
              <th className="text-right p-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                      {(u.first_name?.[0] || u.username[0]).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white text-sm">{u.full_name}</p>
                      <p className="text-xs text-slate-400">@{u.username}</p>
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{u.role_display || u.role}</span>
                </td>
                <td className="p-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ACCESS_COLORS[u.access_level] || 'bg-slate-100 text-slate-600'}`}>
                    {ACCESS_LABELS[u.access_level] || u.access_level}
                  </span>
                </td>
                <td className="p-3 text-sm text-slate-600 dark:text-slate-300">{u.pillar || '—'}</td>
                <td className="p-3 text-sm text-slate-600 dark:text-slate-300">{u.email || '—'}</td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setShowChangeRoleModal(u)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20" title="Change Role">
                      <UserCog className="h-4 w-4" />
                    </button>
                    <button onClick={() => setShowResetModal(u)} className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20" title="Reset password">
                      <KeyRound className="h-4 w-4" />
                    </button>
                    <button onClick={() => setDeleteConfirm(u)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20" title="Delete user">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <CreateUserModal roles={roles} pillars={pillars} onClose={() => setShowCreateModal(false)} onCreated={() => { setShowCreateModal(false); onRefresh(); }} />
      )}
      {showResetModal && <ResetPasswordModal user={showResetModal} onClose={() => setShowResetModal(null)} />}
      {showChangeRoleModal && (
        <ChangeRoleModal
          user={showChangeRoleModal}
          roles={roles}
          onClose={() => setShowChangeRoleModal(null)}
          onSaved={() => { setShowChangeRoleModal(null); onRefresh(); }}
        />
      )}
      {deleteConfirm && (
        <ConfirmModal title="Delete User" message={<>Are you sure you want to delete <strong>{deleteConfirm.full_name}</strong>?</>} onConfirm={() => handleDelete(deleteConfirm)} onCancel={() => setDeleteConfirm(null)} />
      )}
    </>
  );
}

/* ========== ROLES TAB ========== */
function RolesTab({ roles, onRefresh }: { roles: RoleType[]; onRefresh: () => void }) {
  const [showCreate, setShowCreate] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<RoleType | null>(null);

  const handleDelete = async (role: RoleType) => {
    try {
      await authAPI.deleteRole(role.id);
      toast.success(`Role "${role.name}" deleted`);
      setDeleteConfirm(null);
      onRefresh();
    } catch {
      toast.error('Cannot delete role (may be in use)');
    }
  };

  return (
    <>
      <div className="flex justify-end">
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm">
          <Plus className="h-4 w-4" /> Add Role
        </button>
      </div>

      <div className="grid gap-3">
        {roles.map(r => (
          <div key={r.id} className="card p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="font-medium text-slate-900 dark:text-white">{r.name}</span>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${ACCESS_COLORS[r.access_level] || 'bg-slate-100'}`}>
                {ACCESS_LABELS[r.access_level] || r.access_level}
              </span>
              {r.description && <span className="text-xs text-slate-400">{r.description}</span>}
            </div>
            <button onClick={() => setDeleteConfirm(r)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {showCreate && <CreateRoleModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); onRefresh(); }} />}
      {deleteConfirm && (
        <ConfirmModal title="Delete Role" message={<>Are you sure you want to delete role <strong>{deleteConfirm.name}</strong>?</>} onConfirm={() => handleDelete(deleteConfirm)} onCancel={() => setDeleteConfirm(null)} />
      )}
    </>
  );
}

/* ========== PILLARS TAB ========== */
function PillarsTab({ pillars, onRefresh }: { pillars: { id: number; name: string }[]; onRefresh: () => void }) {
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await pillarAPI.create({ name: newName.trim() });
      toast.success(`Pillar "${newName}" created`);
      setNewName('');
      onRefresh();
    } catch {
      toast.error('Failed to create pillar (may already exist)');
    }
    setAdding(false);
  };

  const handleDelete = async (p: { id: number; name: string }) => {
    try {
      await pillarAPI.delete(p.id);
      toast.success(`Pillar "${p.name}" deleted`);
      setDeleteConfirm(null);
      onRefresh();
    } catch {
      toast.error('Cannot delete pillar (may be in use)');
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <input className="input-field flex-1" placeholder="New pillar name..." value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
        <button onClick={handleAdd} disabled={adding || !newName.trim()} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed">
          <Plus className="h-4 w-4" /> {adding ? 'Adding...' : 'Add Pillar'}
        </button>
      </div>

      <div className="grid gap-3">
        {pillars.map(p => (
          <div key={p.id} className="card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Tag className="h-4 w-4 text-indigo-500" />
              <span className="font-medium text-slate-900 dark:text-white">{p.name}</span>
            </div>
            <button onClick={() => setDeleteConfirm(p)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {deleteConfirm && (
        <ConfirmModal title="Delete Pillar" message={<>Are you sure you want to delete pillar <strong>{deleteConfirm.name}</strong>?</>} onConfirm={() => handleDelete(deleteConfirm)} onCancel={() => setDeleteConfirm(null)} />
      )}
    </>
  );
}

/* ========== MODALS ========== */
function CreateUserModal({ roles, pillars, onClose, onCreated }: { roles: RoleType[]; pillars: { id: number; name: string }[]; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ username: '', email: '', first_name: '', last_name: '', password: '', role: roles.find(r => r.access_level === 'OWN_ONLY')?.slug || roles[0]?.slug || '', pillar: '' });
  const [saving, setSaving] = useState(false);

  const selectedRole = roles.find(r => r.slug === form.role);
  const needsPillar = selectedRole?.access_level === 'PILLAR_BASED';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username || !form.password) { toast.error('Username and password are required'); return; }
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (needsPillar && !form.pillar) { toast.error('Pillar is required for this role'); return; }
    setSaving(true);
    try {
      await authAPI.createUser(form);
      toast.success(`User "${form.username}" created`);
      onCreated();
    } catch (err: unknown) {
      const error = err as { response?: { data?: Record<string, string[]> } };
      const msg = error.response?.data ? Object.values(error.response.data).flat().join(', ') : 'Failed to create user';
      toast.error(msg);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="card p-6 w-full max-w-lg space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Create User</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">First Name</label>
              <input className="input-field w-full" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Last Name</label>
              <input className="input-field w-full" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Username *</label>
            <input className="input-field w-full" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Email</label>
            <input type="email" className="input-field w-full" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Password *</label>
            <input type="password" className="input-field w-full" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={8} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Role *</label>
              <select className="input-field w-full" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                {roles.map(r => <option key={r.id} value={r.slug}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Pillar {needsPillar && '*'}</label>
              <select className="input-field w-full" value={form.pillar} onChange={e => setForm({ ...form, pillar: e.target.value })}>
                <option value="">— None —</option>
                {pillars.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>
          </div>
          {selectedRole && (
            <p className="text-xs text-slate-400 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-lg">
              Access: {ACCESS_LABELS[selectedRole.access_level] || selectedRole.access_level}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary px-4 py-2 rounded-lg text-sm">
              {saving ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateRoleModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', access_level: 'OWN_ONLY', description: '' });
  const [saving, setSaving] = useState(false);

  const toSlug = (name: string) => name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) { toast.error('Role name is required'); return; }
    setSaving(true);
    try {
      await authAPI.createRole({ ...form, slug: toSlug(form.name) });
      toast.success(`Role "${form.name}" created`);
      onCreated();
    } catch (err: unknown) {
      const error = err as { response?: { data?: Record<string, string[]> } };
      const msg = error.response?.data ? Object.values(error.response.data).flat().join(', ') : 'Failed to create role';
      toast.error(msg);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="card p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Add Role</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Role Name *</label>
            <input className="input-field w-full" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Technical Consultant" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Access Level *</label>
            <select className="input-field w-full" value={form.access_level} onChange={e => setForm({ ...form, access_level: e.target.value })}>
              <option value="ADMIN">Admin – Full platform management</option>
              <option value="FULL_ACCESS">Full Access – All projects</option>
              <option value="PILLAR_BASED">Pillar Based – Projects by assigned pillar</option>
              <option value="OWN_ONLY">Own Only – Own projects only</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Description</label>
            <input className="input-field w-full" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional description" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary px-4 py-2 rounded-lg text-sm">
              {saving ? 'Creating...' : 'Add Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResetPasswordModal({ user, onClose }: { user: User; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setSaving(true);
    try {
      await authAPI.resetPassword(user.id, password);
      toast.success(`Password reset for "${user.username}"`);
      onClose();
    } catch {
      toast.error('Failed to reset password');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="card p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Reset Password</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-sm text-slate-500">Set a new password for <strong>{user.full_name}</strong></p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="password" className="input-field w-full" placeholder="New password (min 8 chars)" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary px-4 py-2 rounded-lg text-sm">
              {saving ? 'Resetting...' : 'Reset Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmModal({ title, message, onConfirm, onCancel }: { title: string; message: React.ReactNode; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="card p-6 w-full max-w-sm space-y-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
        </div>
      </div>
    </div>
  );
}

function ChangeRoleModal({ user, roles, onClose, onSaved }: { user: User; roles: RoleType[]; onClose: () => void; onSaved: () => void }) {
  const [selectedRole, setSelectedRole] = useState(user.role);
  const [saving, setSaving] = useState(false);

  const currentRole = roles.find(r => r.slug === selectedRole);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRole === user.role) { onClose(); return; }
    setSaving(true);
    try {
      await authAPI.changeRole(user.id, selectedRole);
      toast.success(`Role changed to "${currentRole?.name || selectedRole}" for ${user.username}`);
      onSaved();
    } catch {
      toast.error('Failed to change role');
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="card p-6 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-indigo-500" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Change Role</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
            {(user.first_name?.[0] || user.username[0]).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-slate-900 dark:text-white text-sm">{user.full_name}</p>
            <p className="text-xs text-slate-400">@{user.username} · Current role: <span className="font-medium text-indigo-600 dark:text-indigo-400">{user.role_display || user.role}</span></p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">New Role</label>
            <div className="space-y-2">
              {roles.map(r => (
                <label key={r.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedRole === r.slug
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}>
                  <input
                    type="radio"
                    name="role"
                    value={r.slug}
                    checked={selectedRole === r.slug}
                    onChange={() => setSelectedRole(r.slug)}
                    className="sr-only"
                  />
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    selectedRole === r.slug ? 'border-indigo-500' : 'border-slate-300 dark:border-slate-600'
                  }`}>
                    {selectedRole === r.slug && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{r.name}</p>
                    {r.description && <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{r.description}</p>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${ACCESS_COLORS[r.access_level] || 'bg-slate-100 text-slate-600'}`}>
                    {ACCESS_LABELS[r.access_level] || r.access_level}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary px-4 py-2 rounded-lg text-sm disabled:opacity-50">
              {saving ? 'Saving...' : 'Apply Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
