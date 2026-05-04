export interface User {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: string;
  role_display: string;
  access_level: string;
  pillar: string;
  is_approved: boolean;
  avatar: string | null;
  phone: string;
  timezone: string;
  department: string;
  notification_email: boolean;
  notification_inapp: boolean;
  date_joined: string;
  profile?: UserProfile;
}

export interface UserProfile {
  bio: string;
  position: string;
  skills: string;
  working_hours_per_day: number;
}

export interface UserMinimal {
  id: string;
  username: string;
  full_name: string;
  avatar: string | null;
  role: string;
}

export type UserRole = string;

export interface RoleType {
  id: number;
  slug: string;
  name: string;
  access_level: string;
  description: string;
  created_at: string;
}

export type ProjectStatus = 'DRAFT' | 'ONGOING' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
export type ProjectPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'CANCELLED' | 'BLOCKED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type MilestoneStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'MISSED' | 'CANCELLED';

export interface Tag {
  id: number;
  name: string;
  color: string;
}

export interface ProjectCategory {
  id: number;
  name: string;
  color: string;
  icon: string;
  description: string;
  project_count: number;
}

export interface Pillar {
  id: number;
  name: string;
  created_at: string;
}

export interface ProjectMember {
  id: number;
  user: UserMinimal;
  role_in_project: string;
  joined_at: string;
}

export interface Project {
  id: string;
  title: string;
  slug: string;
  description: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  pillar: string;
  client_name: string;
  project_manager: string;
  custom_fields: Record<string, string>;
  category: ProjectCategory | null;
  owner: UserMinimal;
  manager: UserMinimal | null;
  start_date: string | null;
  end_date: string | null;
  actual_completion_date: string | null;
  estimated_hours: number;
  logged_hours: number;
  tcv: number | null;
  tcv_display: number | null;
  progress_percent: number;
  is_public: boolean;
  color_label: string;
  cover_image: string | null;
  tags: Tag[];
  days_until_deadline: number | null;
  is_overdue: boolean;
  health_score: number;
  tasks_count: number;
  tasks_done: number;
  member_count: number;
  members?: ProjectMember[];
  milestones?: Milestone[];
  created_by?: UserMinimal;
  created_at: string;
  updated_at: string;
}

export interface Milestone {
  id: string;
  project: string;
  title: string;
  description: string;
  due_date: string | null;
  completed_at: string | null;
  status: MilestoneStatus;
  order: number;
  created_by: UserMinimal;
  created_at: string;
  progress_percent: number;
  tasks_count: number;
}

export interface Task {
  id: string;
  project: string;
  milestone: string | null;
  parent_task: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_to: UserMinimal[];
  created_by: UserMinimal;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  estimated_hours: number;
  logged_hours: number;
  tags: Tag[];
  order: number;
  is_recurring: boolean;
  is_overdue: boolean;
  subtasks_count: number;
  subtasks_done: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
}

export interface TimeLog {
  id: string;
  task: string;
  user: UserMinimal;
  hours_logged: number;
  date: string;
  description: string;
  created_at: string;
}

export interface Comment {
  id: string;
  project: string | null;
  task: string | null;
  author: UserMinimal;
  content: string;
  parent: string | null;
  is_edited: boolean;
  replies: Comment[];
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  project: string | null;
  task: string | null;
  actor: UserMinimal;
  action_type: string;
  description: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}

export interface Attachment {
  id: string;
  project: string | null;
  task: string | null;
  uploaded_by: string;
  uploaded_by_name: string;
  file: string;
  file_name: string;
  file_size: number;
  file_type: string;
  created_at: string;
}

export interface Notification {
  id: string;
  recipient: string;
  title: string;
  message: string;
  notification_type: string;
  project: string | null;
  task: string | null;
  link: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface Reminder {
  id: string;
  project: string;
  trigger_type: string;
  days_before: number;
  remind_on: string | null;
  channel: string;
  message: string;
  is_sent: boolean;
  is_active: boolean;
  created_at: string;
}

export interface DashboardData {
  summary: {
    total_projects: number;
    draft: number;
    ongoing: number;
    on_hold: number;
    completed: number;
    cancelled: number;
    expired: number;
  };
  alerts: {
    items: {
      id: string;
      title: string;
      severity: 'critical' | 'urgent' | 'warning';
      type: 'overdue' | 'urgent' | 'expiring';
      message: string;
      end_date: string;
      status: string;
      progress: number;
    }[];
    overdue_projects_count: number;
    urgent_projects_count: number;
    expiring_soon_count: number;
    overdue_tasks_count: number;
  };
  my_tasks_today: { id: string; title: string; priority: string; project: string }[];
  budget: { total: number; spent: number; projects_with_tcv: number; total_projects: number };
  charts: {
    status_distribution: { name: string; value: number; key: string }[];
    priority_distribution: { name: string; value: number; key: string }[];
    monthly_completed: { month: string; completed: number }[];
    tcv_by_year: { year: string; tcv: number }[];
    tcv_by_pillar: { pillar: string; tcv: number }[];
  };
  top_projects: Project[];
  recent_activity: ActivityLog[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: string;
  color: string;
  project_id: string;
  task_id?: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface EmailConfig {
  id: number;
  smtp_host: string;
  smtp_port: number;
  smtp_use_tls: boolean;
  smtp_user: string;
  smtp_password_set: boolean;
  from_email: string;
  display_name: string;
  reply_to: string;
  is_active: boolean;
}

export interface EmailLog {
  id: number;
  recipient_email: string;
  subject: string;
  body: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  error_message: string;
  sent_at: string | null;
  created_at: string;
}

export interface ProjectExpiryReminder {
  id: number;
  project: string;
  project_title: string;
  stage: number;
  sent_at: string;
  recipients_json: string;
  created_at: string;
}

export interface UserEmail {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  pillar: string;
}
