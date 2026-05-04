from django.urls import path
from .views import (
    OverviewReport, ProgressTrendReport, BudgetReport, TimeTrackingReport,
    TeamProductivityReport, UpcomingDeadlinesReport, WorkloadReport,
    ExportReport, CalendarEventsView, CalendarCustomEventListCreate,
    CalendarCustomEventDelete, ImportProjectFromExcel, BulkCreateProjectsFromExcel,
)

urlpatterns = [
    path('overview/', OverviewReport.as_view()),
    path('progress-trend/', ProgressTrendReport.as_view()),
    path('budget/', BudgetReport.as_view()),
    path('time-tracking/', TimeTrackingReport.as_view()),
    path('team-productivity/', TeamProductivityReport.as_view()),
    path('upcoming-deadlines/', UpcomingDeadlinesReport.as_view()),
    path('workload/', WorkloadReport.as_view()),
    path('export/', ExportReport.as_view()),
    path('import-excel/', ImportProjectFromExcel.as_view()),
    path('import-excel/bulk-create/', BulkCreateProjectsFromExcel.as_view()),
    path('calendar/events/', CalendarEventsView.as_view()),
    path('calendar/custom-events/', CalendarCustomEventListCreate.as_view()),
    path('calendar/custom-events/<uuid:pk>/', CalendarCustomEventDelete.as_view()),
]
