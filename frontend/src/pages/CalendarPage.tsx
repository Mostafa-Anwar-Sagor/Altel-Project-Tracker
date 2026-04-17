import { useEffect, useState, useMemo, useCallback } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import { reportAPI } from '@/api/endpoints';
import { LoadingSpinner } from '@/components/ui';
import { Calendar as CalIcon, Clock, Target, ListTodo, Users, Plus, X, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const EVENT_TYPES: Record<string, { color: string; label: string; icon: typeof CalIcon }> = {
  deadline: { color: '#ef4444', label: 'Deadlines', icon: Clock },
  milestone: { color: '#8b5cf6', label: 'Milestones', icon: Target },
  task: { color: '#6366f1', label: 'Tasks', icon: ListTodo },
  meeting: { color: '#06b6d4', label: 'Meetings', icon: Users },
  reminder: { color: '#f59e0b', label: 'Reminders', icon: Clock },
  other: { color: '#64748b', label: 'Other', icon: CalIcon },
};

const CUSTOM_EVENT_TYPES = [
  { value: 'meeting', label: 'Meeting', color: '#06b6d4' },
  { value: 'deadline', label: 'Deadline', color: '#ef4444' },
  { value: 'reminder', label: 'Reminder', color: '#f59e0b' },
  { value: 'other', label: 'Other', color: '#64748b' },
];

interface CalEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: string;
  allDay?: boolean;
  isCustom?: boolean;
  description?: string;
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<typeof Views[keyof typeof Views]>(Views.MONTH);
  const [date, setDate] = useState(new Date());
  const [filterType, setFilterType] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);
  const [newEvent, setNewEvent] = useState({
    title: '', description: '', event_type: 'meeting', date: '', start_time: '', end_time: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchEvents = useCallback(() => {
    setLoading(true);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    reportAPI.calendarEvents(month).then((res) => {
      const calEvents: CalEvent[] = (res.data || []).map((e: any) => ({
        id: e.id || Math.random().toString(),
        title: e.title,
        start: new Date(e.date + 'T00:00:00'),
        end: new Date(e.date + 'T23:59:59'),
        type: e.type || 'deadline',
        allDay: true,
        isCustom: !!e.is_custom,
        description: e.description || '',
      }));
      setEvents(calEvents);
      setLoading(false);
    }).catch(() => {
      setEvents([]);
      setLoading(false);
    });
  }, [date]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const filteredEvents = useMemo(() =>
    filterType === 'all' ? events : events.filter((e) => e.type === filterType),
    [events, filterType]
  );

  const eventCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach((e) => { counts[e.type] = (counts[e.type] || 0) + 1; });
    return counts;
  }, [events]);

  const eventStyleGetter = useCallback((event: CalEvent) => ({
    style: {
      backgroundColor: EVENT_TYPES[event.type]?.color || '#6366f1',
      borderRadius: '6px',
      border: 'none',
      color: 'white',
      fontSize: '12px',
      padding: '2px 8px',
      fontWeight: 500,
      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
      cursor: 'pointer',
    },
  }), []);

  const handleSelectEvent = useCallback((event: CalEvent) => {
    setSelectedEvent(event);
  }, []);

  const handleAddEvent = async () => {
    if (!newEvent.title.trim() || !newEvent.date) {
      toast.error('Title and date are required');
      return;
    }
    setSubmitting(true);
    try {
      await reportAPI.createCustomEvent({
        title: newEvent.title.trim(),
        description: newEvent.description.trim(),
        event_type: newEvent.event_type,
        date: newEvent.date,
        start_time: newEvent.start_time || null,
        end_time: newEvent.end_time || null,
        color: CUSTOM_EVENT_TYPES.find((t) => t.value === newEvent.event_type)?.color || '#06b6d4',
      });
      toast.success('Event added');
      setShowAddModal(false);
      setNewEvent({ title: '', description: '', event_type: 'meeting', date: '', start_time: '', end_time: '' });
      fetchEvents();
    } catch {
      toast.error('Failed to add event');
    }
    setSubmitting(false);
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Delete this event?')) return;
    try {
      await reportAPI.deleteCustomEvent(eventId);
      toast.success('Event deleted');
      setSelectedEvent(null);
      fetchEvents();
    } catch {
      toast.error('Failed to delete event');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Calendar</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {events.length} events this period
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm shadow-lg shadow-indigo-500/20"
        >
          <Plus className="h-4 w-4" /> Add Event
        </button>
      </div>

      {/* Legend + Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setFilterType('all')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterType === 'all'
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-800'
                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50 dark:text-slate-400'
            }`}
          >
            <CalIcon className="h-3.5 w-3.5" />
            All ({events.length})
          </button>
          {Object.entries(EVENT_TYPES).map(([type, { color, label, icon: Icon }]) => (
            <button
              key={type}
              onClick={() => setFilterType(type === filterType ? 'all' : type)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterType === type
                  ? 'ring-1 ring-current bg-opacity-10'
                  : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50 dark:text-slate-400'
              }`}
              style={filterType === type ? { color, backgroundColor: `${color}15` } : undefined}
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              {label} ({eventCounts[type] || 0})
            </button>
          ))}
        </div>
      </div>

      {/* Calendar */}
      <div className="card p-4 calendar-container" style={{ height: '700px' }}>
        <Calendar
          localizer={localizer}
          events={filteredEvents}
          view={view as any}
          onView={(v: any) => setView(v)}
          date={date}
          onNavigate={setDate}
          eventPropGetter={eventStyleGetter as any}
          onSelectEvent={handleSelectEvent as any}
          popup
          style={{ height: '100%' }}
        />
      </div>

      {/* Add Event Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAddModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">Add Event</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title *</label>
              <input
                type="text"
                value={newEvent.title}
                onChange={(e) => setNewEvent((p) => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Team Meeting, Client Review"
                className="input-field w-full py-2 text-sm"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
              <textarea
                value={newEvent.description}
                onChange={(e) => setNewEvent((p) => ({ ...p, description: e.target.value }))}
                placeholder="Optional details..."
                rows={2}
                className="input-field w-full py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Event Type</label>
                <select
                  value={newEvent.event_type}
                  onChange={(e) => setNewEvent((p) => ({ ...p, event_type: e.target.value }))}
                  className="input-field w-full py-2 text-sm"
                >
                  {CUSTOM_EVENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date *</label>
                <input
                  type="date"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent((p) => ({ ...p, date: e.target.value }))}
                  className="input-field w-full py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Start Time</label>
                <input
                  type="time"
                  value={newEvent.start_time}
                  onChange={(e) => setNewEvent((p) => ({ ...p, start_time: e.target.value }))}
                  className="input-field w-full py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">End Time</label>
                <input
                  type="time"
                  value={newEvent.end_time}
                  onChange={(e) => setNewEvent((p) => ({ ...p, end_time: e.target.value }))}
                  className="input-field w-full py-2 text-sm"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleAddEvent}
                disabled={submitting}
                className="btn-primary px-4 py-2.5 rounded-lg text-sm flex-1"
              >
                {submitting ? 'Adding...' : 'Add Event'}
              </button>
              <button onClick={() => setShowAddModal(false)} className="btn-secondary px-4 py-2.5 rounded-lg text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event Detail Popup */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectedEvent(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: EVENT_TYPES[selectedEvent.type]?.color || '#6366f1' }} />
                <span className="text-xs font-medium text-slate-500 uppercase">{selectedEvent.type}</span>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">{selectedEvent.title}</h3>
            <p className="text-sm text-slate-500">
              {selectedEvent.start.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            {selectedEvent.description && (
              <p className="text-sm text-slate-600 dark:text-slate-400">{selectedEvent.description}</p>
            )}
            {selectedEvent.isCustom && (
              <button
                onClick={() => handleDeleteEvent(selectedEvent.id)}
                className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 mt-2"
              >
                <Trash2 className="h-4 w-4" /> Delete this event
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
