import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { authAPI, emailAPI } from '@/api/endpoints';
import type { EmailConfig, EmailLog, UserEmail } from '@/types';
import {
  User as UserIcon, Moon, Sun, Bell, Lock, Save, Shield, Mail, Phone,
  Building2, Globe, Palette, Server, Send, RefreshCw, CheckCircle2,
  XCircle, AlertTriangle, Users, Search, ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/utils/helpers';

type SettingsTab = 'profile' | 'appearance' | 'notifications' | 'password';
type NotifSubtab = 'preferences' | 'smtp' | 'compose' | 'logs';

export default function SettingsPage() {
  const { user, loadUser } = useAuthStore();
  const { darkMode, toggleDarkMode } = useUIStore();
  const [tab, setTab] = useState<SettingsTab>('profile');
  const [profile, setProfile] = useState({ first_name: '', last_name: '', email: '', phone: '', department: '', timezone: '' });
  const [passwords, setPasswords] = useState({ old_password: '', new_password: '', new_password2: '' });
  const [saving, setSaving] = useState(false);
  const isAdmin = user?.access_level === 'ADMIN';

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState({ notification_email: true, notification_inapp: true });
  const [notifSubtab, setNotifSubtab] = useState<NotifSubtab>('preferences');

  // SMTP config
  const [smtpConfig, setSmtpConfig] = useState<Partial<EmailConfig>>({
    smtp_host: '', smtp_port: 587, smtp_use_tls: true, smtp_user: '', from_email: '',
    display_name: 'ProTracker Notifications', reply_to: '', is_active: false,
  });
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpPasswordSet, setSmtpPasswordSet] = useState(false);
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testingSMTP, setTestingSMTP] = useState(false);
  const [testEmailError, setTestEmailError] = useState<string | null>(null);
  const [testEmailSuccess, setTestEmailSuccess] = useState(false);

  // Email composer
  const [allUsers, setAllUsers] = useState<UserEmail[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [showRecipientDropdown, setShowRecipientDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Email logs
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowRecipientDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (user) {
      setProfile({
        first_name: user.first_name || '', last_name: user.last_name || '',
        email: user.email || '', phone: user.phone || '',
        department: user.department || '',
        timezone: user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setNotifPrefs({
        notification_email: user.notification_email ?? true,
        notification_inapp: user.notification_inapp ?? true,
      });
    }
  }, [user]);

  useEffect(() => {
    if (tab === 'notifications' && isAdmin) {
      if (notifSubtab === 'smtp') loadSMTPConfig();
      if (notifSubtab === 'compose') loadUsers();
      if (notifSubtab === 'logs') loadEmailLogs();
    }
  }, [tab, notifSubtab, isAdmin]);  // eslint-disable-line react-hooks/exhaustive-deps

  const loadSMTPConfig = async () => {
    setSmtpLoading(true);
    try {
      const res = await emailAPI.getConfig();
      const c = res.data;
      setSmtpConfig({
        smtp_host: c.smtp_host, smtp_port: c.smtp_port, smtp_use_tls: c.smtp_use_tls,
        smtp_user: c.smtp_user, from_email: c.from_email,
        display_name: c.display_name, reply_to: c.reply_to, is_active: c.is_active,
      });
      setSmtpPasswordSet(c.smtp_password_set);
    } catch { /* first time, no config */ }
    setSmtpLoading(false);
  };

  const loadUsers = async () => {
    try {
      const res = await emailAPI.getUsersEmails();
      setAllUsers(res.data);
    } catch { /* ignore */ }
  };

  const loadEmailLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await emailAPI.getLogs();
      setEmailLogs(res.data);
    } catch { /* ignore */ }
    setLogsLoading(false);
  };

  const handleProfileSave = async () => {
    setSaving(true);
    try {
      await authAPI.updateMe(profile);
      await loadUser();
      toast.success('Profile updated successfully');
    } catch {
      toast.error('Failed to update profile');
    }
    setSaving(false);
  };

  const handleNotifPrefsSave = async () => {
    setSaving(true);
    try {
      await authAPI.updateMe(notifPrefs);
      await loadUser();
      toast.success('Notification preferences saved');
    } catch {
      toast.error('Failed to save preferences');
    }
    setSaving(false);
  };

  const handleSMTPSave = async () => {
    setSaving(true);
    try {
      const data: Record<string, unknown> = { ...smtpConfig };
      if (smtpPassword) data.smtp_password = smtpPassword;
      await emailAPI.updateConfig(data as Partial<EmailConfig> & { smtp_password?: string });
      toast.success('SMTP configuration saved');
      setSmtpPassword('');
      await loadSMTPConfig();
    } catch {
      toast.error('Failed to save SMTP configuration');
    }
    setSaving(false);
  };

  const handleTestEmail = async () => {
    if (!testEmail) { toast.error('Enter a test email address'); return; }
    setTestingSMTP(true);
    setTestEmailError(null);
    setTestEmailSuccess(false);
    try {
      await emailAPI.testEmail(testEmail);
      setTestEmailSuccess(true);
      toast.success('Test email sent! Check your inbox.');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to send test email';
      setTestEmailError(msg);
    }
    setTestingSMTP(false);
  };

  const handleSendCustomEmail = async () => {
    if (!selectedRecipients.length) { toast.error('Select at least one recipient'); return; }
    if (!emailSubject.trim()) { toast.error('Subject is required'); return; }
    if (!emailBody.trim()) { toast.error('Body is required'); return; }
    setSendingEmail(true);
    try {
      await emailAPI.sendCustomEmail({ to_emails: selectedRecipients, subject: emailSubject, body: emailBody });
      toast.success('Email sent successfully!');
      setSelectedRecipients([]); setEmailSubject(''); setEmailBody('');
    } catch {
      toast.error('Failed to send email');
    }
    setSendingEmail(false);
  };

  const handleTriggerReminders = async () => {
    try {
      const res = await emailAPI.triggerReminders();
      const r = res.data.result;
      toast.success(`Reminders: ${r.sent} sent, ${r.skipped} already sent, ${r.expired} expired`);
    } catch {
      toast.error('Failed to trigger reminders');
    }
  };

  const toggleRecipient = (email: string) => {
    setSelectedRecipients(prev => prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]);
  };

  const selectAllRecipients = () => {
    const emails = allUsers.filter(u => u.email).map(u => u.email);
    setSelectedRecipients(emails);
  };

  const handlePasswordChange = async () => {
    if (passwords.new_password !== passwords.new_password2) { toast.error('Passwords do not match'); return; }
    if (passwords.new_password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setSaving(true);
    try {
      await authAPI.changePassword(passwords);
      toast.success('Password changed successfully');
      setPasswords({ old_password: '', new_password: '', new_password2: '' });
    } catch {
      toast.error('Failed to change password');
    }
    setSaving(false);
  };

  const filteredUsers = allUsers.filter(u => {
    if (!recipientSearch) return true;
    const q = recipientSearch.toLowerCase();
    return u.username.toLowerCase().includes(q) || u.first_name.toLowerCase().includes(q) ||
      u.last_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
  });

  const tabs: { key: SettingsTab; label: string; icon: typeof UserIcon; desc: string }[] = [
    { key: 'profile', label: 'Profile', icon: UserIcon, desc: 'Personal info' },
    { key: 'appearance', label: 'Appearance', icon: Palette, desc: 'Theme & display' },
    { key: 'notifications', label: 'Notifications', icon: Bell, desc: 'Alert preferences' },
    { key: 'password', label: 'Security', icon: Shield, desc: 'Password & auth' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Manage your account preferences</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-52 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all',
                  tab === t.key
                    ? 'bg-indigo-50 dark:bg-indigo-900/40 shadow-sm'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                )}
              >
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center',
                  tab === t.key ? 'bg-indigo-100 dark:bg-indigo-900/60' : 'bg-slate-100 dark:bg-slate-700'
                )}>
                  <t.icon className={cn('h-4 w-4', tab === t.key ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400')} />
                </div>
                <div>
                  <p className={cn('text-sm font-medium', tab === t.key ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300')}>{t.label}</p>
                  <p className="text-[10px] text-slate-400">{t.desc}</p>
                </div>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1">
          {tab === 'profile' && (
            <div className="space-y-6">
              {/* User card */}
              <div className="card p-6">
                <div className="flex items-center gap-4 pb-6 border-b border-slate-200 dark:border-slate-700">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg">
                    <span className="text-2xl font-bold text-white">{user?.first_name?.[0] || user?.username?.[0] || 'U'}</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                      {user?.first_name || user?.username || 'User'} {user?.last_name || ''}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">@{user?.username}</p>
                    <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                      <Shield className="h-2.5 w-2.5" /> {user?.role?.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      <UserIcon className="h-3.5 w-3.5 text-slate-400" /> First Name
                    </label>
                    <input value={profile.first_name} onChange={(e) => setProfile({ ...profile, first_name: e.target.value })} className="input-field w-full py-2.5 text-sm" />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      <UserIcon className="h-3.5 w-3.5 text-slate-400" /> Last Name
                    </label>
                    <input value={profile.last_name} onChange={(e) => setProfile({ ...profile, last_name: e.target.value })} className="input-field w-full py-2.5 text-sm" />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    <Mail className="h-3.5 w-3.5 text-slate-400" /> Email
                  </label>
                  <input type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} className="input-field w-full py-2.5 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      <Phone className="h-3.5 w-3.5 text-slate-400" /> Phone
                    </label>
                    <input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} className="input-field w-full py-2.5 text-sm" />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      <Building2 className="h-3.5 w-3.5 text-slate-400" /> Department
                    </label>
                    <input value={profile.department} onChange={(e) => setProfile({ ...profile, department: e.target.value })} className="input-field w-full py-2.5 text-sm" />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    <Globe className="h-3.5 w-3.5 text-slate-400" /> Timezone
                  </label>
                  <input value={profile.timezone} onChange={(e) => setProfile({ ...profile, timezone: e.target.value })} className="input-field w-full py-2.5 text-sm" />
                </div>
                <div className="mt-6">
                  <button onClick={handleProfileSave} disabled={saving} className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm shadow-lg shadow-indigo-500/20">
                    <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Changes'}  
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 'appearance' && (
            <div className="card p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Appearance</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Customize your visual experience</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => darkMode && toggleDarkMode()}
                  className={cn(
                    'p-5 rounded-xl border-2 transition-all text-left',
                    !darkMode
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  )}
                >
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center mb-3">
                    <Sun className="h-5 w-5 text-amber-500" />
                  </div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-white">Light Mode</p>
                  <p className="text-xs text-slate-400 mt-0.5">Clean and bright interface</p>
                  {!darkMode && <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2" />}
                </button>
                <button
                  onClick={() => !darkMode && toggleDarkMode()}
                  className={cn(
                    'p-5 rounded-xl border-2 transition-all text-left',
                    darkMode
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  )}
                >
                  <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center mb-3">
                    <Moon className="h-5 w-5 text-slate-300" />
                  </div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-white">Dark Mode</p>
                  <p className="text-xs text-slate-400 mt-0.5">Easy on the eyes at night</p>
                  {darkMode && <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2" />}
                </button>
              </div>
            </div>
          )}

          {tab === 'notifications' && (
            <div className="space-y-4">
              {/* Sub-tabs for admin */}
              {isAdmin && (
                <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  {([
                    { key: 'preferences' as NotifSubtab, label: 'Preferences', icon: Bell },
                    { key: 'smtp' as NotifSubtab, label: 'SMTP Config', icon: Server },
                    { key: 'compose' as NotifSubtab, label: 'Email Composer', icon: Send },
                    { key: 'logs' as NotifSubtab, label: 'Email Logs', icon: Mail },
                  ]).map((st) => (
                    <button
                      key={st.key}
                      onClick={() => setNotifSubtab(st.key)}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all',
                        notifSubtab === st.key
                          ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                      )}
                    >
                      <st.icon className="h-3.5 w-3.5" />
                      {st.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Preferences sub-tab */}
              {notifSubtab === 'preferences' && (
                <div className="card p-6 space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Notification Preferences</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Choose what alerts you want to receive</p>
                  </div>
                  <div className="space-y-3">
                    {[
                      { key: 'notification_email' as const, label: 'Email Notifications', desc: 'Receive project alerts and reminders via email', icon: Mail, val: notifPrefs.notification_email },
                      { key: 'notification_inapp' as const, label: 'In-App Notifications', desc: 'Show notifications within the application', icon: Bell, val: notifPrefs.notification_inapp },
                    ].map((pref) => (
                      <div key={pref.key} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/40 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center">
                            <pref.icon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{pref.label}</p>
                            <p className="text-xs text-slate-400">{pref.desc}</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={pref.val}
                            onChange={(e) => setNotifPrefs({ ...notifPrefs, [pref.key]: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-300 peer-checked:bg-indigo-600 rounded-full peer-focus:ring-2 peer-focus:ring-indigo-300 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:shadow-sm after:transition-all peer-checked:after:translate-x-5" />
                        </label>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={handleNotifPrefsSave} disabled={saving} className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm shadow-lg shadow-indigo-500/20">
                      <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Preferences'}
                    </button>
                    {isAdmin && (
                      <button onClick={handleTriggerReminders} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors">
                        <RefreshCw className="h-4 w-4" /> Trigger 4-Stage Reminders
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* SMTP Configuration sub-tab (Admin only) */}
              {notifSubtab === 'smtp' && isAdmin && (
                <div className="card p-6 space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-white">SMTP Configuration</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Configure organizational email server for sending notifications</p>
                  </div>
                  {smtpLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-5 w-5 animate-spin text-slate-400" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/40 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className={cn('w-3 h-3 rounded-full', smtpConfig.is_active ? 'bg-emerald-500' : 'bg-red-400')} />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                            Email Sending: {smtpConfig.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" checked={smtpConfig.is_active || false}
                            onChange={(e) => setSmtpConfig({ ...smtpConfig, is_active: e.target.checked })}
                            className="sr-only peer" />
                          <div className="w-11 h-6 bg-slate-300 peer-checked:bg-emerald-600 rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:shadow-sm after:transition-all peer-checked:after:translate-x-5" />
                        </label>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">SMTP Host</label>
                          <input value={smtpConfig.smtp_host || ''} onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_host: e.target.value })} placeholder="mail.company.com" className="input-field w-full py-2.5 text-sm" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">SMTP Port</label>
                          <input type="number" value={smtpConfig.smtp_port || 587} onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_port: parseInt(e.target.value) || 587 })} className="input-field w-full py-2.5 text-sm" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">SMTP User</label>
                          <input value={smtpConfig.smtp_user || ''} onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_user: e.target.value })} placeholder="notifications@company.com" className="input-field w-full py-2.5 text-sm" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                            SMTP Password {smtpPasswordSet && <span className="text-xs text-emerald-500 ml-1">(set)</span>}
                          </label>
                          <input type="password" value={smtpPassword} onChange={(e) => setSmtpPassword(e.target.value)} placeholder={smtpPasswordSet ? '••••••••' : 'Enter password'} className="input-field w-full py-2.5 text-sm" autoComplete="off" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">From Email</label>
                        <input value={smtpConfig.from_email || ''} onChange={(e) => setSmtpConfig({ ...smtpConfig, from_email: e.target.value })} placeholder="noreply@company.com" className="input-field w-full py-2.5 text-sm" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                            Display Name <span className="text-xs text-slate-400 font-normal">(shown as sender name)</span>
                          </label>
                          <input value={smtpConfig.display_name || ''} onChange={(e) => setSmtpConfig({ ...smtpConfig, display_name: e.target.value })} placeholder="ProTracker Notifications" className="input-field w-full py-2.5 text-sm" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                            Reply-To <span className="text-xs text-slate-400 font-normal">(optional)</span>
                          </label>
                          <input value={smtpConfig.reply_to || ''} onChange={(e) => setSmtpConfig({ ...smtpConfig, reply_to: e.target.value })} placeholder="admin@company.com" className="input-field w-full py-2.5 text-sm" />
                        </div>
                      </div>
                      {smtpConfig.display_name && smtpConfig.from_email && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-700/60 rounded-lg">
                          <Mail className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Preview: <span className="font-medium text-slate-700 dark:text-slate-200">{smtpConfig.display_name} &lt;{smtpConfig.from_email}&gt;</span>
                          </p>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="smtp_tls" checked={smtpConfig.smtp_use_tls || false}
                          onChange={(e) => setSmtpConfig({ ...smtpConfig, smtp_use_tls: e.target.checked })}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                        <label htmlFor="smtp_tls" className="text-sm text-slate-700 dark:text-slate-300">Use TLS encryption</label>
                      </div>
                      <div className="flex items-center gap-3 pt-2">
                        <button onClick={handleSMTPSave} disabled={saving} className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm">
                          <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save SMTP Config'}
                        </button>
                      </div>
                      <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Test SMTP Connection</h3>
                        <div className="flex gap-3">
                          <input value={testEmail} onChange={(e) => { setTestEmail(e.target.value); setTestEmailError(null); setTestEmailSuccess(false); }} placeholder="your@email.com" className="input-field flex-1 py-2.5 text-sm" />
                          <button onClick={handleTestEmail} disabled={testingSMTP} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50">
                            <Send className="h-4 w-4" /> {testingSMTP ? 'Sending...' : 'Send Test'}
                          </button>
                        </div>
                        {testEmailSuccess && (
                          <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-emerald-700 dark:text-emerald-300">Test email sent successfully! Check your inbox.</p>
                          </div>
                        )}
                        {testEmailError && (
                          <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                            <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-semibold text-red-700 dark:text-red-300 mb-1">Email Failed</p>
                              <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed">{testEmailError}</p>
                              {testEmailError.includes('5.7.3') || testEmailError.includes('SMTP AUTH') || testEmailError.includes('Basic SMTP') ? (
                                <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800">
                                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Quick Fix for Testing:</p>
                                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Use Gmail instead: host=<strong>smtp.gmail.com</strong>, port=<strong>587</strong>, with a Gmail App Password from myaccount.google.com → Security → App passwords</p>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Email Composer sub-tab (Admin only) */}
              {notifSubtab === 'compose' && isAdmin && (
                <div className="card p-6 space-y-5">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Email Composer</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Send custom branded emails to team members</p>
                  </div>

                  {/* Recipients */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Recipients
                      <span className="ml-2 text-xs font-normal text-slate-400">
                        {selectedRecipients.length > 0 ? `${selectedRecipients.length} selected` : 'none selected'}
                      </span>
                    </label>
                    <div ref={dropdownRef} className="relative">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                          <input
                            value={recipientSearch}
                            onChange={(e) => { setRecipientSearch(e.target.value); setShowRecipientDropdown(true); }}
                            onFocus={() => setShowRecipientDropdown(true)}
                            placeholder="Search users by name, email, or role..."
                            className="input-field w-full py-2.5 text-sm pl-9 pr-9"
                          />
                          <button
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); setShowRecipientDropdown(v => !v); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2"
                          >
                            <ChevronDown className={cn('h-4 w-4 text-slate-400 transition-transform', showRecipientDropdown && 'rotate-180')} />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={selectAllRecipients}
                          className="px-3 py-2.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
                        >
                          <Users className="h-3.5 w-3.5 inline mr-1" />All
                        </button>
                        {selectedRecipients.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedRecipients([])}
                            className="px-3 py-2.5 rounded-lg text-xs font-medium text-red-600 border border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors whitespace-nowrap"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      {showRecipientDropdown && (
                        <div className="absolute z-20 w-full max-h-56 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl">
                          {filteredUsers.length === 0 ? (
                            <div className="px-4 py-6 text-center">
                              <Users className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                              <p className="text-sm text-slate-400">
                                {recipientSearch ? `No users matching "${recipientSearch}"` : 'No users available'}
                              </p>
                            </div>
                          ) : (
                            filteredUsers.map(u => (
                              <button
                                key={u.id}
                                type="button"
                                onMouseDown={(e) => { e.preventDefault(); if (u.email) toggleRecipient(u.email); }}
                                className={cn(
                                  'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                                  u.email
                                    ? 'hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer'
                                    : 'opacity-40 cursor-not-allowed',
                                  u.email && selectedRecipients.includes(u.email) && 'bg-indigo-50 dark:bg-indigo-900/20'
                                )}
                              >
                                <div className={cn(
                                  'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                                  u.email && selectedRecipients.includes(u.email)
                                    ? 'bg-indigo-600 border-indigo-600'
                                    : 'border-slate-300 dark:border-slate-600'
                                )}>
                                  {u.email && selectedRecipients.includes(u.email) && (
                                    <CheckCircle2 className="h-3 w-3 text-white" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                                    {u.first_name || u.last_name
                                      ? `${u.first_name} ${u.last_name}`.trim()
                                      : u.username}
                                    {' '}
                                    <span className="text-slate-400 font-normal text-xs">@{u.username}</span>
                                  </p>
                                  <p className="text-xs text-slate-400 truncate">
                                    {u.email
                                      ? <><span className="text-green-600 dark:text-green-400">{u.email}</span> · {u.role}</>
                                      : <span className="text-amber-500">no email set · {u.role}</span>
                                    }
                                  </p>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                    {selectedRecipients.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {selectedRecipients.map(email => (
                          <span key={email} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-medium">
                            <Mail className="h-3 w-3" />
                            {email}
                            <button type="button" onClick={() => toggleRecipient(email)} className="hover:text-red-500 transition-colors ml-0.5">
                              <XCircle className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Subject */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Subject <span className="text-red-500">*</span></label>
                    <input
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="Email subject..."
                      className="input-field w-full py-2.5 text-sm"
                    />
                  </div>

                  {/* Body */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Message Body <span className="text-red-500">*</span>
                      <span className="ml-2 text-xs font-normal text-slate-400">(Sent as branded HTML email)</span>
                    </label>
                    <textarea
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      placeholder="Type your message here...&#10;&#10;Use blank lines to separate paragraphs."
                      rows={8}
                      className="input-field w-full py-2.5 text-sm resize-y font-mono"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSendCustomEmail}
                      disabled={sendingEmail || !selectedRecipients.length || !emailSubject.trim() || !emailBody.trim()}
                      className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="h-4 w-4" />
                      {sendingEmail ? 'Sending...' : `Send to ${selectedRecipients.length || '?'} recipient${selectedRecipients.length !== 1 ? 's' : ''}`}
                    </button>
                    {!selectedRecipients.length && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">Select at least one recipient</p>
                    )}
                  </div>
                </div>
              )}

              {/* Email Logs sub-tab (Admin only) */}
              {notifSubtab === 'logs' && isAdmin && (                <div className="card p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Email Logs</h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">History of all sent emails</p>
                    </div>
                    <button onClick={loadEmailLogs} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                      <RefreshCw className={cn('h-3.5 w-3.5', logsLoading && 'animate-spin')} /> Refresh
                    </button>
                  </div>
                  {emailLogs.length === 0 ? (
                    <div className="text-center py-8">
                      <Mail className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                      <p className="text-sm text-slate-400">No emails sent yet</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                            <th className="pb-2 font-medium">Recipient</th>
                            <th className="pb-2 font-medium">Subject</th>
                            <th className="pb-2 font-medium">Status</th>
                            <th className="pb-2 font-medium">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {emailLogs.map(log => (
                            <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <td className="py-2.5 text-slate-700 dark:text-slate-300">{log.recipient_email}</td>
                              <td className="py-2.5 text-slate-700 dark:text-slate-300 max-w-[200px] truncate">{log.subject}</td>
                              <td className="py-2.5">
                                <span className={cn(
                                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                                  log.status === 'SENT' && 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
                                  log.status === 'FAILED' && 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
                                  log.status === 'PENDING' && 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
                                )}>
                                  {log.status === 'SENT' && <CheckCircle2 className="h-3 w-3" />}
                                  {log.status === 'FAILED' && <XCircle className="h-3 w-3" />}
                                  {log.status === 'PENDING' && <AlertTriangle className="h-3 w-3" />}
                                  {log.status}
                                </span>
                              </td>
                              <td className="py-2.5 text-xs text-slate-400">
                                {log.sent_at ? new Date(log.sent_at).toLocaleString() : new Date(log.created_at).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}}
                              className="sr-only peer" />
                            <div className="w-11 h-6 bg-slate-300 peer-checked:bg-emerald-600 rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:shadow-sm after:transition-all peer-checked:after:translate-x-5" />
                          </label>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                            Bot Token {tgBotTokenSet && <span className="text-xs text-emerald-500 ml-1">✓ configured</span>}
                          </label>
                          <input
                            type="password"
                            value={tgBotToken}
                            onChange={(e) => setTgBotToken(e.target.value)}
                            placeholder={tgBotTokenSet ? '••••••••  (leave blank to keep existing token)' : 'Paste token from @BotFather'}
                            className="input-field w-full py-2.5 text-sm font-mono"
                            autoComplete="off"
                          />
                        </div>

                        <div className="pt-1">
                          <button onClick={handleTGSave} disabled={saving}
                            className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm shadow-lg shadow-indigo-500/20">
                            <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Config'}
                          </button>
                        </div>

                        {/* Webhook section */}
                        <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Register Webhook</h3>
                          <p className="text-xs text-slate-400 mb-3">
                            Required so users can send commands to the bot (<code className="font-mono">/link</code>, <code className="font-mono">/projects</code>, etc.).
                            For local dev, run <code className="font-mono bg-slate-100 dark:bg-slate-700 px-1 rounded text-xs">ngrok http 8000</code> and paste the HTTPS URL below.
                          </p>
                          <div className="flex gap-3">
                            <input
                              value={webhookUrl}
                              onChange={(e) => setWebhookUrl(e.target.value)}
                              placeholder="https://xxxx.ngrok.io/api/notifications/telegram-webhook/"
                              className="input-field flex-1 py-2.5 text-sm"
                            />
                            <button onClick={handleSetWebhook} disabled={settingWebhook}
                              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 whitespace-nowrap">
                              <Globe className="h-4 w-4" />
                              {settingWebhook ? 'Setting...' : 'Set Webhook'}
                            </button>
                          </div>
                        </div>

                        {/* Test section */}
                        <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Test Bot Connection</h3>
                          <p className="text-xs text-slate-400 mb-3">
                            Enter your Telegram chat ID to verify the bot can send messages.
                            Find your ID by messaging <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline">@userinfobot</a>.
                          </p>
                          <div className="flex gap-3">
                            <input
                              value={tgTestChatId}
                              onChange={(e) => { setTgTestChatId(e.target.value); setTgTestError(null); setTgTestSuccess(false); }}
                              placeholder="e.g. 123456789"
                              className="input-field flex-1 py-2.5 text-sm"
                            />
                            <button onClick={handleTGTest} disabled={tgTestingSend}
                              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50">
                              <MessageSquare className="h-4 w-4" />
                              {tgTestingSend ? 'Sending...' : 'Send Test'}
                            </button>
                          </div>
                          {tgTestSuccess && (
                            <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                              <p className="text-sm text-emerald-700 dark:text-emerald-300">Test message sent! Check your Telegram app.</p>
                            </div>
                          )}
                          {tgTestError && (
                            <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                              <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-sm font-semibold text-red-700 dark:text-red-300 mb-1">Test Failed</p>
                                <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed">{tgTestError}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Telegram Logs card */}
                  <div className="card p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-base font-semibold text-slate-800 dark:text-white">Telegram Send Logs</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">History of all messages sent by the bot</p>
                      </div>
                      <button onClick={loadTGLogs} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                        <RefreshCw className={cn('h-3.5 w-3.5', tgLogsLoading && 'animate-spin')} /> Refresh
                      </button>
                    </div>
                    {tgLogs.length === 0 ? (
                      <div className="text-center py-6">
                        <MessageSquare className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                        <p className="text-sm text-slate-400">No Telegram messages sent yet</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                              <th className="pb-2 font-medium">Recipient</th>
                              <th className="pb-2 font-medium">Message</th>
                              <th className="pb-2 font-medium">Status</th>
                              <th className="pb-2 font-medium">Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {tgLogs.map(log => (
                              <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                <td className="py-2.5 text-slate-700 dark:text-slate-300 font-mono text-xs">
                                  {log.recipient_name || log.recipient_chat_id}
                                </td>
                                <td className="py-2.5 text-slate-500 dark:text-slate-400 max-w-[200px] truncate text-xs">
                                  {log.message.split('\n')[0]}
                                </td>
                                <td className="py-2.5">
                                  <span className={cn(
                                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                                    log.status === 'SENT'
                                      ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                                      : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
                                  )}>
                                    {log.status === 'SENT' ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                    {log.status}
                                  </span>
                                </td>
                                <td className="py-2.5 text-xs text-slate-400">
                                  {log.sent_at ? new Date(log.sent_at).toLocaleString() : new Date(log.created_at).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'password' && (
            <div className="card p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Change Password</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Ensure your account stays secure</p>
              </div>
              <div className="max-w-md space-y-4">
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    <Lock className="h-3.5 w-3.5 text-slate-400" /> Current Password
                  </label>
                  <input type="password" value={passwords.old_password} onChange={(e) => setPasswords({ ...passwords, old_password: e.target.value })} className="input-field w-full py-2.5 text-sm" autoComplete="current-password" />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    <Lock className="h-3.5 w-3.5 text-slate-400" /> New Password
                  </label>
                  <input type="password" value={passwords.new_password} onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })} className="input-field w-full py-2.5 text-sm" autoComplete="new-password" />
                  {passwords.new_password && (
                    <div className="mt-2">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className={cn('h-1 flex-1 rounded-full', passwords.new_password.length >= i * 3 ? (i >= 3 ? 'bg-emerald-500' : i >= 2 ? 'bg-amber-500' : 'bg-red-500') : 'bg-slate-200 dark:bg-slate-700')} />
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {passwords.new_password.length < 6 ? 'Weak' : passwords.new_password.length < 9 ? 'Fair' : 'Strong'}
                      </p>
                    </div>
                  )}
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    <Lock className="h-3.5 w-3.5 text-slate-400" /> Confirm New Password
                  </label>
                  <input type="password" value={passwords.new_password2} onChange={(e) => setPasswords({ ...passwords, new_password2: e.target.value })} className="input-field w-full py-2.5 text-sm" autoComplete="new-password" />
                  {passwords.new_password2 && passwords.new_password !== passwords.new_password2 && (
                    <p className="text-xs text-red-500 mt-1">Passwords don't match</p>
                  )}
                </div>
                <button onClick={handlePasswordChange} disabled={saving} className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm shadow-lg shadow-indigo-500/20">
                  <Shield className="h-4 w-4" /> {saving ? 'Changing...' : 'Update Password'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
