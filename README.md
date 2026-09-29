# ProTracker 🚀

ProTracker is a comprehensive, full-stack project tracking and management application designed to streamline team collaboration, task assignment, and project oversight. The platform features a responsive, modern frontend and a robust backend, ready for deployment on Microsoft Azure.

## 🌟 Features

- **Interactive Dashboard:** Visual analytics and charts (powered by Recharts) to track project progress and team performance.
- **Task Management:** Kanban-style drag-and-drop task organization (using dnd-kit) and calendar views.
- **Project Workspaces:** Dedicated areas for projects, complete with comments, file attachments, and status tracking.
- **Real-time Notifications:** WebSockets integration (Django Channels) and Twilio SMS for instant updates.
- **Background Processing:** Celery integration for handling scheduled and asynchronous tasks like reporting and email notifications.
- **Azure Ready:** Pre-configured deployment scripts (`azure-deploy.ps1`) and configuration files for Azure App Service and Azure Static Web Apps.

## 🛠️ Technology Stack

### Frontend
- **Framework:** React 18 with Vite
- **Styling:** Tailwind CSS, PostCSS
- **State Management:** Zustand
- **Routing:** React Router v6
- **Data Visualization:** Recharts, React Big Calendar
- **Interactions:** @dnd-kit (Drag and Drop)
- **Forms:** React Hook Form

### Backend
- **Framework:** Django 5 & Django REST Framework
- **Asynchronous/WebSockets:** Django Channels, Daphne
- **Task Queue:** Celery, Django Celery Beat
- **Database:** SQLite (Configured for persistent storage on Azure App Service)
- **Authentication:** Simple JWT
- **External Integrations:** Twilio (SMS capabilities)

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
Run migrations and start the server:
```bash
python manage.py migrate
python manage.py runserver
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

## ☁️ Azure Deployment

The project is already configured for deployment on Microsoft Azure. 
- The backend can be deployed to an **Azure App Service** (Linux/Python environment). See `.env.azure.example` for required environment variables.
- The frontend can be deployed to an **Azure Static Web App**.
- You can use the provided PowerShell script `azure-deploy.ps1` to automate the deployment process.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License
This project is licensed under the MIT License - see the LICENSE file for details.
