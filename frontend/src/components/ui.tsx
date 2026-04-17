import { cn } from '@/utils/helpers';

const statusStyles: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
  ONGOING: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  ON_HOLD: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  HOLD: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  PROCESSING: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  CANCELLED: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
  EXPIRED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  NOT_STARTED: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
  TODO: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
  IN_PROGRESS: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  IN_REVIEW: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  DONE: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  BLOCKED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  MISSED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

export function StatusBadge({ status }: { status: string }) {
  const label = status.replace(/_/g, ' ');
  return (
    <span className={cn('status-badge inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium', statusStyles[status] || statusStyles.NOT_STARTED)}>
      {label}
    </span>
  );
}

const priorityStyles: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  MEDIUM: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  LOW: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
};

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={cn('inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium', priorityStyles[priority] || priorityStyles.MEDIUM)}>
      {priority}
    </span>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const clamp = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2', className)}>
      <div
        className={cn(
          'h-2 rounded-full transition-all duration-500',
          clamp >= 100 ? 'bg-green-500' : clamp >= 60 ? 'bg-indigo-500' : clamp >= 30 ? 'bg-yellow-500' : 'bg-red-500'
        )}
        style={{ width: `${clamp}%` }}
      />
    </div>
  );
}

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center py-12', className)}>
      <div className="h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: {
  icon: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-4" />
      <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300">{title}</h3>
      {description && <p className="text-sm text-slate-400 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, size = 'md' }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  if (!open) return null;
  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className={cn('relative bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full mx-4', widths[size])}>
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xl">&times;</button>
        </div>
        <div className="p-4 max-h-[70vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', variant = 'danger' }: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'primary';
}) {
  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{message}</p>
      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="btn-secondary px-4 py-2 text-sm rounded-lg">Cancel</button>
        <button
          onClick={() => { onConfirm(); onClose(); }}
          className={cn(
            'px-4 py-2 text-sm rounded-lg text-white',
            variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
          )}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function HealthScore({ score, showLabel = true }: { score: number; showLabel?: boolean }) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const radius = 22;
  const strokeWidth = 5;
  const dim = (radius + strokeWidth) * 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - clamped / 100);

  const { stroke, textCls, label } =
    clamped >= 75
      ? { stroke: '#22c55e', textCls: 'text-green-500', label: 'Healthy' }
      : clamped >= 60
      ? { stroke: '#eab308', textCls: 'text-yellow-500', label: 'Moderate' }
      : clamped >= 40
      ? { stroke: '#f97316', textCls: 'text-orange-500', label: 'At Risk' }
      : { stroke: '#ef4444', textCls: 'text-red-500', label: 'Critical' };

  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex-shrink-0" style={{ width: dim, height: dim }}>
        <svg width={dim} height={dim} style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx={dim / 2} cy={dim / 2} r={radius}
            fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth}
            className="dark:stroke-slate-700"
          />
          <circle
            cx={dim / 2} cy={dim / 2} r={radius}
            fill="none" stroke={stroke} strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('text-xs font-bold tabular-nums', textCls)}>{clamped}</span>
        </div>
      </div>
      {showLabel && (
        <div className="leading-tight">
          <p className={cn('text-sm font-semibold', textCls)}>{label}</p>
          <p className="text-xs text-slate-400">{clamped}/100</p>
        </div>
      )}
    </div>
  );
}
