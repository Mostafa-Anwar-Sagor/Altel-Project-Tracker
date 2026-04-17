import api from './client';
import type {
  Project, Task, Milestone, Comment, Attachment, Notification, Reminder,
  DashboardData, CalendarEvent, Tag, ProjectCategory, PaginatedResponse,
  UserMinimal, User, TimeLog, ActivityLog, Pillar, RoleType,
  EmailConfig, EmailLog, ProjectExpiryReminder, UserEmail,
} from '@/types';

// Auth
export const authAPI = {
  login: (data: { username: string; password: string }) => api.post('/auth/login/', data),
  refreshToken: (refresh: string) => api.post('/auth/token/refresh/', { refresh }),
  me: () => api.get<User>('/auth/users/me/'),
  updateMe: (data: Partial<User>) => api.patch<User>('/auth/users/me/', data),
  changePassword: (data: { old_password: string; new_password: string }) =>
    api.post('/auth/users/change_password/', data),
  getUsers: (params?: Record<string, string>) => api.get<User[]>('/auth/users/', { params }),
  getUsersMinimal: () => api.get<UserMinimal[]>('/auth/users/minimal/'),
  createUser: (data: Record<string, string>) => api.post<User>('/auth/users/create-user/', data),
  updateUser: (id: string, data: Partial<User>) => api.patch<User>(`/auth/users/${id}/`, data),
  deleteUser: (id: string) => api.delete(`/auth/users/${id}/`),
  resetPassword: (id: string, password: string) => api.post(`/auth/users/${id}/reset-password/`, { password }),
  getRoles: () => api.get<RoleType[]>('/auth/roles/'),
  createRole: (data: { slug: string; name: string; access_level: string; description?: string }) =>
    api.post<RoleType>('/auth/roles/', data),
  deleteRole: (id: number) => api.delete(`/auth/roles/${id}/`),
  changeRole: (id: string, role: string) => api.post<User>(`/auth/users/${id}/change-role/`, { role }),
};

// Projects
export const projectAPI = {
  list: (params?: Record<string, string>) => api.get<PaginatedResponse<Project>>('/projects/', { params }),
  get: (id: string) => api.get<Project>(`/projects/${id}/`),
  create: (data: Record<string, unknown>) => api.post<Project>('/projects/', data),
  update: (id: string, data: Record<string, unknown>) => api.patch<Project>(`/projects/${id}/`, data),
  delete: (id: string) => api.delete(`/projects/${id}/`),
  summary: () => api.get('/projects/summary/'),
  overdue: () => api.get<Project[]>('/projects/overdue/'),
  expiringSoon: (days = 7) => api.get<Project[]>('/projects/expiring-soon/', { params: { days } }),
  my: () => api.get<Project[]>('/projects/my/'),
  addMember: (id: string, data: { user_id: string; role_in_project: string }) =>
    api.post(`/projects/${id}/members/add/`, data),
  removeMember: (id: string, userId: string) =>
    api.delete(`/projects/${id}/members/remove/`, { data: { user_id: userId } }),
  activity: (id: string) => api.get<ActivityLog[]>(`/projects/${id}/activity/`),
  health: (id: string) => api.get(`/projects/${id}/health/`),
  timeline: (id: string) => api.get(`/projects/${id}/timeline/`),
};

// Milestones
export const milestoneAPI = {
  list: (projectId: string) => api.get<Milestone[]>(`/projects/${projectId}/milestones/`),
  create: (projectId: string, data: Record<string, unknown>) =>
    api.post<Milestone>(`/projects/${projectId}/milestones/`, data),
  update: (projectId: string, id: string, data: Record<string, unknown>) =>
    api.patch<Milestone>(`/projects/${projectId}/milestones/${id}/`, data),
  delete: (projectId: string, id: string) =>
    api.delete(`/projects/${projectId}/milestones/${id}/`),
  complete: (projectId: string, id: string) =>
    api.post(`/projects/${projectId}/milestones/${id}/complete/`),
};

// Tasks
export const taskAPI = {
  list: (params?: Record<string, string>) => api.get<PaginatedResponse<Task>>('/tasks/', { params }),
  get: (id: string) => api.get<Task>(`/tasks/${id}/`),
  create: (data: Record<string, unknown>) => api.post<Task>('/tasks/', data),
  update: (id: string, data: Record<string, unknown>) => api.patch<Task>(`/tasks/${id}/`, data),
  delete: (id: string) => api.delete(`/tasks/${id}/`),
  my: () => api.get<Task[]>('/tasks/my/'),
  overdue: () => api.get<Task[]>('/tasks/overdue/'),
  assign: (id: string, userIds: string[]) => api.post(`/tasks/${id}/assign/`, { user_ids: userIds }),
  logTime: (id: string, data: { hours_logged: number; date: string; description: string }) =>
    api.post<TimeLog>(`/tasks/${id}/log-time/`, data),
  timelogs: (id: string) => api.get<TimeLog[]>(`/tasks/${id}/timelogs/`),
  board: (projectId: string) => api.get<Task[]>('/tasks/board/', { params: { project: projectId } }),
  reorder: (items: { id: string; order: number; status?: string }[]) =>
    api.post('/tasks/reorder/', { items }),
};

// Comments
export const commentAPI = {
  list: (params?: Record<string, string>) => api.get<PaginatedResponse<Comment>>('/comments/', { params }),
  create: (data: Record<string, unknown>) => api.post<Comment>('/comments/', data),
  update: (id: string, data: { content: string }) => api.patch<Comment>(`/comments/${id}/`, data),
  delete: (id: string) => api.delete(`/comments/${id}/`),
};

// Attachments
export const attachmentAPI = {
  list: (params?: Record<string, string>) => api.get<PaginatedResponse<Attachment>>('/attachments/', { params }),
  upload: (data: FormData) => api.post<Attachment>('/attachments/', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  delete: (id: string) => api.delete(`/attachments/${id}/`),
};

// Notifications
export const notificationAPI = {
  list: (params?: Record<string, string>) => api.get<PaginatedResponse<Notification>>('/notifications/', { params }),
  markRead: (id: string) => api.patch(`/notifications/${id}/read/`),
  markAllRead: () => api.post('/notifications/mark-all-read/'),
  unreadCount: () => api.get<{ count: number }>('/notifications/unread-count/'),
};

// Reminders
export const reminderAPI = {
  list: (params?: Record<string, string>) => api.get<PaginatedResponse<Reminder>>('/reminders/', { params }),
  create: (data: Record<string, unknown>) => api.post<Reminder>('/reminders/', data),
  update: (id: string, data: Record<string, unknown>) => api.patch<Reminder>(`/reminders/${id}/`, data),
  delete: (id: string) => api.delete(`/reminders/${id}/`),
  sendNow: (id: string) => api.post(`/reminders/${id}/send-now/`),
};

// Dashboard
export const dashboardAPI = {
  get: () => api.get<DashboardData>('/dashboard/'),
};

// Reports
export const reportAPI = {
  overview: () => api.get('/reports/overview/'),
  progressTrend: (params?: Record<string, string>) => api.get('/reports/progress-trend/', { params }),
  budget: () => api.get('/reports/budget/'),
  timeTracking: (params?: Record<string, string>) => api.get('/reports/time-tracking/', { params }),
  teamProductivity: (params?: Record<string, string>) => api.get('/reports/team-productivity/', { params }),
  upcomingDeadlines: (days = 30) => api.get('/reports/upcoming-deadlines/', { params: { days } }),
  workload: () => api.get('/reports/workload/'),
  export: (data: { format: string; report_type: string }) =>
    api.post('/reports/export/', data, { responseType: 'blob' }),
  calendarEvents: (month?: string) => api.get<CalendarEvent[]>('/reports/calendar/events/', { params: { month } }),
  customEvents: () => api.get('/reports/calendar/custom-events/'),
  createCustomEvent: (data: Record<string, unknown>) => api.post('/reports/calendar/custom-events/', data),
  deleteCustomEvent: (id: string) => api.delete(`/reports/calendar/custom-events/${id}/`),
};

// Tags & Categories
export const tagAPI = {
  list: () => api.get<PaginatedResponse<Tag>>('/tags/'),
  create: (data: { name: string; color: string }) => api.post<Tag>('/tags/', data),
};

export const categoryAPI = {
  list: () => api.get<PaginatedResponse<ProjectCategory>>('/categories/'),
  create: (data: Record<string, string>) => api.post<ProjectCategory>('/categories/', data),
};

export const pillarAPI = {
  list: () => api.get<Pillar[]>('/pillars/'),
  create: (data: { name: string }) => api.post<Pillar>('/pillars/', data),
  delete: (id: number) => api.delete(`/pillars/${id}/`),
};

// Email System
export const emailAPI = {
  getConfig: () => api.get<EmailConfig>('/email-config/'),
  updateConfig: (data: Partial<EmailConfig> & { smtp_password?: string }) =>
    api.put<EmailConfig>('/email-config/', data),
  testEmail: (to_email: string) => api.post('/test-email/', { to_email }),
  sendCustomEmail: (data: { to_emails: string[]; subject: string; body: string }) =>
    api.post('/send-email/', data),
  getLogs: () => api.get<EmailLog[]>('/email-logs/'),
  triggerReminders: () => api.post('/trigger-reminders/'),
  getExpiryReminders: (params?: Record<string, string>) =>
    api.get<ProjectExpiryReminder[]>('/expiry-reminders/', { params }),
  getUsersEmails: () => api.get<UserEmail[]>('/users-emails/'),
};
