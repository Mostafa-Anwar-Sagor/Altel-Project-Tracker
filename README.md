# ProTracker 🚀

ProTracker is a comprehensive, enterprise-grade full-stack project tracking and management application designed to streamline team collaboration, task assignment, and project oversight. The platform features a responsive, modern frontend and a robust backend, and is ready for deployment on Microsoft Azure.

---

## 🌟 Key Features

### 🏢 Project & Portfolio Management
- **Project Workspaces:** Dedicated areas for projects complete with timelines, custom fields, budgets (TCV), and assigned clients.
- **Health Scoring:** Automated project health scores calculated dynamically based on schedule adherence, task completion rate, overdue tasks, and recent activity.
- **Milestones:** Track major project phases with due dates and completion tracking.
- **Project Templates:** Create predefined templates with default milestones and tasks to rapidly spin up new projects.
- **Categorization & Tagging:** Group projects by Pillars, Categories, and custom color-coded Tags.
- **Historical Snapshots:** Automated daily/weekly snapshots of project progress, tasks, budget, and logged hours for historical reporting.

### ✅ Advanced Task Management
- **Kanban & Calendar Views:** Organize tasks with drag-and-drop boards (powered by dnd-kit) and interactive calendars (React Big Calendar).
- **Task Hierarchy:** Support for parent tasks and subtasks for granular work breakdown.
- **Time Tracking:** Built-in time logging (hours spent vs. estimated hours) at the task level.
- **Recurring Tasks:** Schedule recurring tasks with customizable recurrence rules.
- **Prioritization & Status:** Track tasks through custom statuses (To Do, In Progress, Review, Blocked, Done) and priorities (Low to Critical).

### 👥 User Roles & Access Control
- **Role-Based Access Control (RBAC):** Strict access levels including Admin, Full Access, Pillar-Based (only see projects in a specific business pillar), and Own-Only.
- **Project-Level Roles:** Granular permissions within projects (Manager, Developer, Designer, Tester, Viewer).
- **User Profiles:** Rich user profiles detailing skills, department, timezone, bio, and working capacity (hours per day).

### 💬 Collaboration & Communication
- **Comments & Mentions:** Threaded discussions on tasks and projects.
- **File Management:** Upload and attach files/documents directly to specific tasks or projects.
- **Real-Time Notifications:** Instant in-app alerts powered by Django Channels (WebSockets).
- **SMS Integration:** Twilio integration for critical, time-sensitive alerts delivered straight to mobile phones.
- **Custom Calendar Events:** Schedule meetings, deadlines, and reminders directly within the app calendar.

### 📊 Analytics & Customizable Dashboards
- **Interactive Dashboard:** Visual analytics, progress charts, and burndown charts powered by Recharts.
- **Customizable Widgets:** Users can add, resize, and reposition their own dashboard widgets.

---

## 🛠️ Technology Stack

### Frontend
- **Framework:** React 18, Vite
- **Styling:** Tailwind CSS, PostCSS, clsx, tailwind-merge
- **State Management:** Zustand
- **Routing:** React Router v6
- **Data Visualization & UI:** Recharts (Charts), React Big Calendar (Calendar), @dnd-kit (Drag and Drop), Lucide React (Icons)
- **Forms & Validation:** React Hook Form
- **API Client:** Axios

### Backend
- **Core Framework:** Django 5.2 & Django REST Framework (DRF)
- **Asynchronous/WebSockets:** Django Channels, Daphne, Redis (optional)
- **Task Queue & Cron Jobs:** Celery, Django Celery Beat
- **Database:** SQLite (Configured for persistent storage on Azure App Service)
- **Authentication:** Simple JWT (JSON Web Tokens)
- **External Integrations:** Twilio (SMS), Whitenoise (Static file serving)

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [Python](https://www.python.org/) (v3.10 or higher recommended)

### 1. Backend Setup
Navigate to the `backend` directory:
```bash
cd backend
```
Create a virtual environment and install dependencies:
```bash
python -m venv venv
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
```
Run migrations and start the development server:
```bash
python manage.py migrate
python manage.py runserver
```

*(Optional) To test WebSockets and Background tasks locally, you will need to start the Celery worker process in a separate terminal:*
```bash
celery -A config worker -l info
```

### 2. Frontend Setup
Open a new terminal and navigate to the `frontend` directory:
```bash
cd frontend
```
Install dependencies and start the Vite development server:
```bash
npm install
npm run dev
```
The frontend should now be running at `http://localhost:5173`.

---

## ☁️ Azure Deployment

This project contains deployment scripts and configurations specifically tailored for **Microsoft Azure**.

1. **Backend (Azure App Service):**
   - Deployed as a Python App Service.
   - Requires setting up environment variables in the Azure Portal (see `backend/.env.azure.example` for reference keys like `SECRET_KEY`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`).
   - `startup.sh` handles database migrations and Gunicorn/Uvicorn server execution automatically upon container startup.

2. **Frontend (Azure Static Web Apps):**
   - Contains a `staticwebapp.config.json` for routing rules (fallback to `index.html` for React Router).
   - Deployed using Azure GitHub Actions or Azure CLI.

3. **Automation:**
   - Run the provided `azure-deploy.ps1` script to automate resource group creation, app service plan setup, and deployment processes.

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License
This project is licensed under the MIT License - see the LICENSE file for details.
