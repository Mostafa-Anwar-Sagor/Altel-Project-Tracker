import { useEffect, useState } from 'react';
import { useNotificationStore } from '@/stores/notificationStore';
import { EmptyState } from '@/components/ui';
import { timeAgo, cn } from '@/utils/helpers';
import { Bell, CheckCheck, Info, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

const TYPE_ICONS: Record<string, { icon: typeof Info; color: string; bg: string }> = {
  DEADLINE_REMINDER: { icon: Clock, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/40' },
  PROJECT_EXPIRED: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/40' },
  STATUS_CHANGED: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/40' },
  TASK_ASSIGNED: { icon: CheckCircle2, color: 'text-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-900/40' },
  COMMENT_MENTION: { icon: Info, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/40' },
  BUDGET_ALERT: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/40' },
  MILESTONE_DUE: { icon: Clock, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/40' },
  DAILY_DIGEST: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/40' },
  MEMBER_ADDED: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/40' },
  OVERDUE_TASK: { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/40' },
  info: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/40' },
};

export default function NotificationsPage() {
  const { notifications, fetchNotifications, markRead, markAllRead } = useNotificationStore();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const filtered = filter === 'unread' ? notifications.filter((n) => !n.is_read) : notifications;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Notifications</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : "You're all caught up!"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <button onClick={() => setFilter('all')} className={cn('px-3 py-1.5 text-xs font-medium transition-colors', filter === 'all' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50')}>
              All ({notifications.length})
            </button>
            <button onClick={() => setFilter('unread')} className={cn('px-3 py-1.5 text-xs font-medium transition-colors', filter === 'unread' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50')}>
              Unread ({unreadCount})
            </button>
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-lg text-sm">
              <CheckCheck className="h-4 w-4" /> Mark all read
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" description={filter === 'unread' ? 'No unread notifications' : "You're all caught up!"} />
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => {
            const typeInfo = TYPE_ICONS[n.notification_type] || TYPE_ICONS.info;
            const Icon = typeInfo.icon;
            return (
              <div
                key={n.id}
                onClick={() => !n.is_read && markRead(n.id)}
                className={cn(
                  'card p-4 flex items-start gap-3 cursor-pointer transition-all hover:shadow-md group',
                  !n.is_read && 'border-l-4 border-l-indigo-500 bg-indigo-50/20 dark:bg-indigo-900/5'
                )}
              >
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', typeInfo.bg)}>
                  <Icon className={cn('h-4 w-4', typeInfo.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  {n.title && (
                    <p className="text-sm font-semibold text-slate-800 dark:text-white mb-0.5">{n.title}</p>
                  )}
                  <p className={cn(
                    'text-sm leading-relaxed',
                    n.is_read ? 'text-slate-500 dark:text-slate-400' : 'text-slate-700 dark:text-slate-200'
                  )}>
                    {n.message}
                  </p>
                  <p className="text-xs text-slate-400 mt-1.5">{timeAgo(n.created_at)}</p>
                </div>
                {!n.is_read && <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full flex-shrink-0 mt-1.5 ring-2 ring-indigo-100 dark:ring-indigo-900/40" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
