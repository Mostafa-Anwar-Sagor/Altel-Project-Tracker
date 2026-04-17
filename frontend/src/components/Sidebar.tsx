import { NavLink } from 'react-router-dom';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/utils/helpers';
import {
  LayoutDashboard, FolderKanban, ListTodo, Calendar,
  BarChart3, Bell, Settings, ChevronLeft, ChevronRight, Zap, Users,
} from 'lucide-react';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/tasks', icon: ListTodo, label: 'My Tasks' },
  { to: '/calendar', icon: Calendar, label: 'Calendar' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/notifications', icon: Bell, label: 'Notifications' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

const adminItems = [
  { to: '/admin/users', icon: Users, label: 'User Management' },
];

export default function Sidebar() {
  const { sidebarOpen, toggleSidebar, setSidebarOpen } = useUIStore();
  const { user } = useAuthStore();
  const isAdmin = user?.access_level === 'ADMIN';

  const allItems = isAdmin ? [...navItems, ...adminItems] : navItems;

  return (
    <aside className={cn(
      'fixed top-0 left-0 z-40 h-screen bg-white dark:bg-slate-800',
      'border-r border-slate-200/80 dark:border-slate-700/80',
      'transition-all duration-300 flex flex-col shadow-sm',
      // Mobile: full-width drawer that slides in/out
      sidebarOpen ? 'w-64' : '-translate-x-full md:translate-x-0 md:w-[72px]'
    )}>
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-slate-200 dark:border-slate-700">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 flex-shrink-0">
          <Zap className="h-5 w-5 text-white" />
        </div>
        {sidebarOpen && (
          <div className="ml-3 flex-1 min-w-0">
            <span className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">ProTracker</span>
            <p className="text-[10px] text-slate-400 -mt-0.5">Project Management</p>
          </div>
        )}
        {/* Close button — mobile only */}
        {sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden ml-2 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {sidebarOpen && <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">Menu</p>}
        {allItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => { if (window.innerWidth < 768) setSidebarOpen(false); }}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative',
              isActive
                ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-700 dark:hover:text-slate-200'
            )}
          >
            {({ isActive }) => (
              <>
                {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-600 dark:bg-indigo-400 rounded-r-full -ml-3" />}
                <item.icon className={cn('h-5 w-5 flex-shrink-0 transition-colors', isActive && 'text-indigo-600 dark:text-indigo-400')} />
                {sidebarOpen && <span>{item.label}</span>}
                {!sidebarOpen && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 dark:bg-slate-700 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-lg">
                    {item.label}
                  </div>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Toggle — desktop only */}
      <button
        onClick={toggleSidebar}
        className="hidden md:flex h-12 items-center justify-center border-t border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
      >
        {sidebarOpen ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
      </button>
    </aside>
  );
}
