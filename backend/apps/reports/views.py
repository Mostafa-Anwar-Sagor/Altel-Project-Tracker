from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.generics import ListCreateAPIView, DestroyAPIView
from django.utils import timezone
from django.db.models import Sum, Count, Q, F
from django.http import HttpResponse
from datetime import timedelta

from apps.projects.models import Project
from apps.tasks.models import Task, TimeLog
from apps.comments.models import ActivityLog
from .models import ProjectSnapshot
from .serializers import ProjectSnapshotSerializer


class OverviewReport(APIView):
    def get(self, request):
        from django.db.models import Avg, Count
        from django.db.models.functions import TruncMonth
        from datetime import date as _date

        user = request.user
        access_level = getattr(user, 'access_level', 'OWN_ONLY')
        today = timezone.now().date()

        # ── Role-based project scope ──────────────────────────────────────
        if getattr(user, 'is_superuser', False) or access_level in ('ADMIN', 'FULL_ACCESS'):
            projects = Project.objects.all()
            scope_label = 'all'
        elif access_level == 'PILLAR_BASED':
            projects = (
                Project.objects.filter(pillar=user.pillar) if user.pillar
                else Project.objects.none()
            )
            scope_label = 'pillar'
        else:  # OWN_ONLY (Account Manager)
            projects = Project.objects.filter(
                Q(owner=user) | Q(created_by=user) | Q(manager=user)
                | Q(members__user=user)
            ).distinct()
            scope_label = 'own'

        status_counts = {}
        for s in Project.Status.choices:
            status_counts[s[0].lower()] = projects.filter(status=s[0]).count()

        priority_counts = {}
        for p in Project.Priority.choices:
            priority_counts[p[0].lower()] = projects.filter(priority=p[0]).count()

        active = projects.exclude(status__in=['CANCELLED'])
        completed_count = status_counts.get('completed', 0)
        active_count = active.count()
        completion_rate = round((completed_count / active_count * 100), 1) if active_count > 0 else 0

        avg_progress = active.aggregate(avg=Avg('progress_percent'))['avg'] or 0

        # By pillar breakdown
        pillar_data = (
            projects.exclude(status='CANCELLED').filter(pillar__isnull=False).exclude(pillar='')
            .values('pillar')
            .annotate(count=Count('id'))
            .order_by('-count')
        )
        by_pillar = [{'pillar': r['pillar'], 'count': r['count']} for r in pillar_data]

        # Project intake trend: full 12-month rolling window (fill zeros)
        twelve_months_ago = today.replace(day=1)
        # Build ordered list of the last 12 months
        months_series = []
        y, m = today.year, today.month
        for _ in range(12):
            months_series.append((y, m))
            m -= 1
            if m == 0:
                m = 12
                y -= 1
        months_series.reverse()  # oldest → newest

        created_trend = (
            projects.filter(created_at__date__gte=_date(months_series[0][0], months_series[0][1], 1))
            .annotate(month=TruncMonth('created_at'))
            .values('month')
            .annotate(count=Count('id'))
        )
        trend_map = {(r['month'].year, r['month'].month): r['count'] for r in created_trend}

        import calendar
        by_month = [
            {
                'month': f"{calendar.month_abbr[mo]} {yr}",
                'count': trend_map.get((yr, mo), 0),
            }
            for yr, mo in months_series
        ]

        return Response({
            'total': projects.count(),
            'by_status': status_counts,
            'by_priority': priority_counts,
            'overdue': projects.filter(
                end_date__lt=today
            ).exclude(status__in=['COMPLETED', 'CANCELLED']).count(),
            'avg_progress': round(float(avg_progress), 1),
            'completion_rate': completion_rate,
            'by_pillar': by_pillar,
            'by_month_created': by_month,
            'scope': scope_label,
        })


class ProgressTrendReport(APIView):
    def get(self, request):
        project_id = request.query_params.get('project')
        days = int(request.query_params.get('days', 30))
        start_date = timezone.now().date() - timedelta(days=days)

        qs = ProjectSnapshot.objects.filter(date__gte=start_date)
        if project_id:
            qs = qs.filter(project_id=project_id)

        return Response(ProjectSnapshotSerializer(qs, many=True).data)


class BudgetReport(APIView):
    """TCV (Total Contract Value) Report — role/pillar-based access."""
    def get(self, request):
        user = request.user
        access_level = getattr(user, 'access_level', 'OWN_ONLY')

        projects = Project.objects.exclude(status='CANCELLED')

        # Role-based queryset filtering
        if not (getattr(user, 'is_superuser', False) or access_level in ('ADMIN', 'FULL_ACCESS')):
            if access_level == 'PILLAR_BASED':
                projects = projects.filter(pillar=user.pillar)
            else:
                projects = projects.filter(
                    Q(owner=user) | Q(created_by=user) | Q(manager=user)
                    | Q(members__user=user)
                ).distinct()

        all_projects = list(projects.values(
            'id', 'title', 'status', 'progress_percent', 'start_date', 'end_date', 'pillar', 'tcv'
        ))
        has_tcv = [p for p in all_projects if p['tcv'] is not None]

        data = []
        for p in has_tcv:
            tcv_val = float(p['tcv'])
            start = p['start_date']
            data.append({
                **p,
                'tcv': tcv_val,
                'year': start.year if start else None,
                'month': start.month if start else None,
            })

        total_tcv = sum(d['tcv'] for d in data)

        # By year
        by_year: dict = {}
        for d in data:
            y = d.get('year') or 'Unknown'
            by_year[y] = by_year.get(y, 0) + d['tcv']
        by_year_list = sorted(
            [{'year': str(k), 'tcv': round(v, 2)} for k, v in by_year.items()],
            key=lambda x: x['year']
        )

        # By month (selected year or current year)
        from datetime import date as _date
        current_year = _date.today().year
        year_param = request.query_params.get('year')
        selected_year = int(year_param) if year_param and year_param.isdigit() else current_year
        month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        by_month: dict = {i: 0.0 for i in range(1, 13)}
        for d in data:
            if d.get('year') == selected_year and d.get('month'):
                by_month[d['month']] = by_month.get(d['month'], 0) + d['tcv']
        by_month_list = [
            {'month': month_names[m - 1], 'tcv': round(v, 2), 'year': selected_year}
            for m, v in by_month.items()
        ]

        # By pillar
        by_pillar: dict = {}
        for d in data:
            pl = d.get('pillar') or 'Unassigned'
            by_pillar[pl] = by_pillar.get(pl, 0) + d['tcv']
        by_pillar_list = sorted(
            [{'pillar': k, 'tcv': round(v, 2)} for k, v in by_pillar.items()],
            key=lambda x: -x['tcv']
        )

        return Response({
            'projects': data,
            'totals': {
                'total_tcv': round(total_tcv, 2),
                'projects_with_tcv': len(data),
                'projects_total': len(all_projects),
            },
            'by_year': by_year_list,
            'by_month': by_month_list,
            'by_pillar': by_pillar_list,
            'selected_year': selected_year,
            'available_years': [str(r['year']) for r in by_year_list],
        })


class TimeTrackingReport(APIView):
    def get(self, request):
        project_id = request.query_params.get('project')
        days = int(request.query_params.get('days', 30))
        start_date = timezone.now().date() - timedelta(days=days)

        logs = TimeLog.objects.filter(date__gte=start_date)
        if project_id:
            logs = logs.filter(task__project_id=project_id)

        by_user = logs.values(
            'user__username', 'user__first_name', 'user__last_name'
        ).annotate(total_hours=Sum('hours_logged')).order_by('-total_hours')

        by_project = logs.values(
            'task__project__title', 'task__project__id'
        ).annotate(total_hours=Sum('hours_logged')).order_by('-total_hours')

        return Response({
            'by_user': list(by_user),
            'by_project': list(by_project),
            'total_hours': float(logs.aggregate(t=Sum('hours_logged'))['t'] or 0),
        })


class TeamProductivityReport(APIView):
    def get(self, request):
        days = int(request.query_params.get('days', 30))
        start_date = timezone.now() - timedelta(days=days)

        from django.contrib.auth import get_user_model
        User = get_user_model()

        users = User.objects.filter(is_approved=True)
        data = []
        for user in users:
            tasks_assigned = Task.objects.filter(assigned_to=user).count()
            tasks_completed = Task.objects.filter(
                assigned_to=user, status='DONE',
                completed_at__gte=start_date
            ).count()
            tasks_overdue = Task.objects.filter(
                assigned_to=user,
                due_date__lt=timezone.now().date()
            ).exclude(status__in=['DONE', 'CANCELLED']).count()
            hours = TimeLog.objects.filter(
                user=user, date__gte=start_date.date()
            ).aggregate(t=Sum('hours_logged'))['t'] or 0

            data.append({
                'user_id': str(user.id),
                'username': user.username,
                'full_name': user.get_full_name() or user.username,
                'tasks_assigned': tasks_assigned,
                'tasks_completed': tasks_completed,
                'tasks_overdue': tasks_overdue,
                'hours_logged': float(hours),
                'completion_rate': round((tasks_completed / tasks_assigned * 100), 1) if tasks_assigned > 0 else 0,
            })

        return Response(sorted(data, key=lambda x: x['tasks_completed'], reverse=True))


class UpcomingDeadlinesReport(APIView):
    def get(self, request):
        days = int(request.query_params.get('days', 30))
        target = timezone.now().date() + timedelta(days=days)

        projects = Project.objects.filter(
            end_date__gte=timezone.now().date(),
            end_date__lte=target
        ).exclude(status__in=['COMPLETED', 'CANCELLED', 'EXPIRED']).order_by('end_date').values(
            'id', 'title', 'status', 'priority', 'end_date', 'progress_percent'
        )

        tasks = Task.objects.filter(
            due_date__gte=timezone.now().date(),
            due_date__lte=target
        ).exclude(status__in=['DONE', 'CANCELLED']).order_by('due_date').values(
            'id', 'title', 'status', 'priority', 'due_date', 'project__title'
        )

        milestones = []
        from apps.projects.models import Milestone
        ms = Milestone.objects.filter(
            due_date__gte=timezone.now().date(),
            due_date__lte=target
        ).exclude(status__in=['COMPLETED', 'CANCELLED']).order_by('due_date').values(
            'id', 'title', 'status', 'due_date', 'project__title'
        )

        return Response({
            'projects': list(projects),
            'tasks': list(tasks),
            'milestones': list(ms),
        })


class WorkloadReport(APIView):
    def get(self, request):
        from django.contrib.auth import get_user_model
        User = get_user_model()

        users = User.objects.filter(is_approved=True)
        data = []
        for user in users:
            active_tasks = Task.objects.filter(
                assigned_to=user
            ).exclude(status__in=['DONE', 'CANCELLED']).count()

            data.append({
                'user_id': str(user.id),
                'username': user.username,
                'full_name': user.get_full_name() or user.username,
                'active_tasks': active_tasks,
            })

        return Response(sorted(data, key=lambda x: x['active_tasks'], reverse=True))


class ExportReport(APIView):
    def post(self, request):
        format_type = request.data.get('format', 'excel')
        report_type = request.data.get('report_type', 'overview')
        # Custom report filters
        filters = {
            'status': request.data.get('status', ''),
            'pillar': request.data.get('pillar', ''),
            'date_from': request.data.get('date_from', ''),
            'date_to': request.data.get('date_to', ''),
            'columns': request.data.get('columns', []),
        }

        if format_type == 'excel':
            return self._export_excel(report_type, filters)
        elif format_type == 'pdf':
            return self._export_pdf(report_type, filters)
        return Response({'error': 'Unsupported format'}, status=status.HTTP_400_BAD_REQUEST)

    def _get_projects_qs(self, filters):
        qs = Project.objects.exclude(status='CANCELLED')
        if filters.get('status'):
            qs = qs.filter(status=filters['status'].upper())
        if filters.get('pillar'):
            qs = qs.filter(category__name__icontains=filters['pillar'])
        if filters.get('date_from'):
            qs = qs.filter(start_date__gte=filters['date_from'])
        if filters.get('date_to'):
            qs = qs.filter(end_date__lte=filters['date_to'])
        return qs.order_by('-created_at')

    def _export_excel(self, report_type, filters):
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side, numbers
        from openpyxl.utils import get_column_letter
        from io import BytesIO
        from django.utils import timezone as tz

        wb = openpyxl.Workbook()
        ws = wb.active

        # Styles
        header_font = Font(bold=True, color='FFFFFF', size=11)
        header_fill = PatternFill('solid', fgColor='3730A3')
        title_font = Font(bold=True, size=14, color='1E1B4B')
        subheader_fill = PatternFill('solid', fgColor='E0E7FF')
        alt_fill = PatternFill('solid', fgColor='F8F9FF')
        center = Alignment(horizontal='center', vertical='center')
        left = Alignment(horizontal='left', vertical='center')
        right = Alignment(horizontal='right', vertical='center')
        thin = Side(style='thin', color='CBD5E1')
        border = Border(left=thin, right=thin, top=thin, bottom=thin)
        rm_fmt = '#,##0.00'

        def style_header_row(ws, row, col_count):
            for c in range(1, col_count + 1):
                cell = ws.cell(row=row, column=c)
                cell.font = header_font
                cell.fill = header_fill
                cell.alignment = center
                cell.border = border

        def style_data_row(ws, row, col_count, alt=False):
            for c in range(1, col_count + 1):
                cell = ws.cell(row=row, column=c)
                if alt:
                    cell.fill = alt_fill
                cell.border = border
                cell.alignment = left

        generated_at = tz.now().strftime('%d %B %Y, %I:%M %p')

        if report_type == 'budget':
            ws.title = 'TCV Report'
            ws.merge_cells('A1:G1')
            ws['A1'] = 'ALTEL PROJECT TRACKER — Total Contract Value (TCV) Report (RM)'
            ws['A1'].font = title_font
            ws['A1'].alignment = center
            ws.merge_cells('A2:G2')
            ws['A2'] = f'Generated: {generated_at}'
            ws['A2'].font = Font(italic=True, color='64748B', size=9)
            ws['A2'].alignment = center
            ws.row_dimensions[1].height = 28
            ws.row_dimensions[2].height = 16

            headers = ['#', 'Project Title', 'Pillar', 'Status', 'Progress (%)', 'TCV (RM)', 'Year']
            for i, h in enumerate(headers, 1):
                ws.cell(row=4, column=i, value=h)
            style_header_row(ws, 4, len(headers))

            projects = self._get_projects_qs(filters).filter(tcv__isnull=False)
            for idx, p in enumerate(projects, 1):
                row = idx + 4
                tcv_val = float(p.tcv or 0)
                yr = p.start_date.year if p.start_date else '—'
                status_label = p.get_status_display() if hasattr(p, 'get_status_display') else p.status
                ws.cell(row=row, column=1, value=idx)
                ws.cell(row=row, column=2, value=p.title)
                ws.cell(row=row, column=3, value=p.pillar or '—')
                ws.cell(row=row, column=4, value=status_label)
                ws.cell(row=row, column=5, value=p.progress_percent)
                ws.cell(row=row, column=6, value=tcv_val).number_format = rm_fmt
                ws.cell(row=row, column=7, value=yr)
                style_data_row(ws, row, len(headers), alt=(idx % 2 == 0))
                ws.cell(row=row, column=5).alignment = center

            # Totals row
            total_row = projects.count() + 5
            ws.cell(row=total_row, column=2, value='TOTALS').font = Font(bold=True)
            ws.cell(row=total_row, column=6, value=sum(float(p.tcv or 0) for p in projects)).number_format = rm_fmt
            ws.cell(row=total_row, column=6).font = Font(bold=True)
            for c in range(1, len(headers) + 1):
                ws.cell(row=total_row, column=c).fill = PatternFill('solid', fgColor='DBEAFE')
                ws.cell(row=total_row, column=c).border = border

            col_widths = [5, 42, 20, 14, 14, 20, 10]
            for i, w in enumerate(col_widths, 1):
                ws.column_dimensions[get_column_letter(i)].width = w

        elif report_type == 'overview':
            ws.title = 'Overview Report'
            ws.merge_cells('A1:F1')
            ws['A1'] = 'ALTEL PROJECT TRACKER — Projects Overview'
            ws['A1'].font = title_font
            ws['A1'].alignment = center
            ws.merge_cells('A2:F2')
            ws['A2'] = f'Generated: {generated_at}'
            ws['A2'].font = Font(italic=True, color='64748B', size=9)
            ws['A2'].alignment = center
            ws.row_dimensions[1].height = 28
            ws.row_dimensions[2].height = 16

            columns = filters.get('columns') or ['title', 'status', 'priority', 'start_date', 'end_date', 'progress']
            col_map = {
                'title': 'Project Title', 'status': 'Status', 'priority': 'Priority',
                'start_date': 'Start Date', 'end_date': 'End Date', 'progress': 'Progress (%)',
                'tcv': 'TCV (RM)', 'health': 'Health Score',
            }
            active_cols = [c for c in columns if c in col_map]
            headers = ['#'] + [col_map[c] for c in active_cols]
            for i, h in enumerate(headers, 1):
                ws.cell(row=4, column=i, value=h)
            style_header_row(ws, 4, len(headers))

            projects = self._get_projects_qs(filters)
            for idx, p in enumerate(projects, 1):
                row = idx + 4
                ws.cell(row=row, column=1, value=idx)
                for ci, col in enumerate(active_cols, 2):
                    val = None
                    if col == 'title': val = p.title
                    elif col == 'status': val = p.status
                    elif col == 'priority': val = p.priority
                    elif col == 'start_date': val = str(p.start_date or '')
                    elif col == 'end_date': val = str(p.end_date or '')
                    elif col == 'progress': val = p.progress_percent
                    elif col == 'tcv':
                        cell = ws.cell(row=row, column=ci, value=float(p.tcv or 0) if p.tcv is not None else None)
                        cell.number_format = rm_fmt
                        continue
                    elif col == 'health': val = p.health_score
                    ws.cell(row=row, column=ci, value=val)
                style_data_row(ws, row, len(headers), alt=(idx % 2 == 0))

            for i in range(1, len(headers) + 1):
                ws.column_dimensions[get_column_letter(i)].width = 20
            ws.column_dimensions['A'].width = 5
            ws.column_dimensions['B'].width = 40

        elif report_type == 'team':
            ws.title = 'Team Productivity'
            ws.merge_cells('A1:G1')
            ws['A1'] = 'ALTEL PROJECT TRACKER — Team Productivity Report'
            ws['A1'].font = title_font
            ws['A1'].alignment = center
            ws.merge_cells('A2:G2')
            ws['A2'] = f'Generated: {generated_at}'
            ws['A2'].font = Font(italic=True, color='64748B', size=9)
            ws['A2'].alignment = center
            ws.row_dimensions[1].height = 28
            from django.contrib.auth import get_user_model
            User = get_user_model()
            headers = ['#', 'Full Name', 'Username', 'Tasks Assigned', 'Completed', 'Overdue', 'Completion Rate (%)']
            for i, h in enumerate(headers, 1):
                ws.cell(row=4, column=i, value=h)
            style_header_row(ws, 4, len(headers))
            from apps.tasks.models import Task, TimeLog
            users = User.objects.filter(is_approved=True)
            for idx, user in enumerate(users, 1):
                row = idx + 4
                assigned = Task.objects.filter(assigned_to=user).count()
                completed = Task.objects.filter(assigned_to=user, status='DONE').count()
                overdue = Task.objects.filter(assigned_to=user, due_date__lt=tz.now().date()).exclude(status__in=['DONE', 'CANCELLED']).count()
                rate = round((completed / assigned * 100), 1) if assigned > 0 else 0
                ws.cell(row=row, column=1, value=idx)
                ws.cell(row=row, column=2, value=user.get_full_name() or user.username)
                ws.cell(row=row, column=3, value=user.username)
                ws.cell(row=row, column=4, value=assigned)
                ws.cell(row=row, column=5, value=completed)
                ws.cell(row=row, column=6, value=overdue)
                ws.cell(row=row, column=7, value=rate)
                style_data_row(ws, row, len(headers), alt=(idx % 2 == 0))
            col_widths = [5, 28, 18, 16, 14, 12, 20]
            for i, w in enumerate(col_widths, 1):
                ws.column_dimensions[get_column_letter(i)].width = w

        else:
            # Default: all projects
            ws.title = 'Projects Report'
            ws.merge_cells('A1:H1')
            ws['A1'] = 'ALTEL PROJECT TRACKER — All Projects'
            ws['A1'].font = title_font
            ws['A1'].alignment = center
            ws.merge_cells('A2:H2')
            ws['A2'] = f'Generated: {generated_at}'
            ws['A2'].font = Font(italic=True, color='64748B', size=9)
            ws['A2'].alignment = center
            ws.row_dimensions[1].height = 28
            ws.row_dimensions[2].height = 16
            headers = ['#', 'Title', 'Status', 'Priority', 'Start Date', 'End Date', 'Progress (%)', 'TCV (RM)']
            for i, h in enumerate(headers, 1):
                ws.cell(row=4, column=i, value=h)
            style_header_row(ws, 4, len(headers))
            projects = self._get_projects_qs(filters)
            for idx, p in enumerate(projects, 1):
                row = idx + 4
                ws.cell(row=row, column=1, value=idx)
                ws.cell(row=row, column=2, value=p.title)
                ws.cell(row=row, column=3, value=p.status)
                ws.cell(row=row, column=4, value=p.priority)
                ws.cell(row=row, column=5, value=str(p.start_date or ''))
                ws.cell(row=row, column=6, value=str(p.end_date or ''))
                ws.cell(row=row, column=7, value=p.progress_percent)
                cell = ws.cell(row=row, column=8, value=float(p.tcv or 0) if p.tcv is not None else None)
                cell.number_format = rm_fmt
                style_data_row(ws, row, len(headers), alt=(idx % 2 == 0))
            col_widths = [5, 40, 14, 12, 14, 14, 14, 18]
            for i, w in enumerate(col_widths, 1):
                ws.column_dimensions[get_column_letter(i)].width = w

        buffer = BytesIO()
        wb.save(buffer)
        buffer.seek(0)
        resp = HttpResponse(
            buffer.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        resp['Content-Disposition'] = f'attachment; filename=altel_{report_type}_report_{tz.now().strftime("%Y%m%d")}.xlsx'
        return resp

    def _export_pdf(self, report_type, filters):
        from io import BytesIO
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.lib import colors
        from reportlab.platypus import (
            SimpleDocTemplate, Table, TableStyle, Paragraph,
            Spacer, HRFlowable, KeepTogether
        )
        from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
        from django.utils import timezone as tz

        generated_at = tz.now().strftime('%d %B %Y, %I:%M %p')
        buffer = BytesIO()

        # Landscape for wide tables
        use_landscape = report_type in ('budget', 'overview')
        page_size = landscape(A4) if use_landscape else A4
        doc = SimpleDocTemplate(
            buffer, pagesize=page_size,
            leftMargin=1.8 * cm, rightMargin=1.8 * cm,
            topMargin=2.2 * cm, bottomMargin=2.2 * cm,
        )

        # Colors
        BRAND_DARK = colors.HexColor('#1E1B4B')
        BRAND = colors.HexColor('#4F46E5')
        BRAND_LIGHT = colors.HexColor('#EEF2FF')
        GRAY = colors.HexColor('#64748B')
        LIGHT_GRAY = colors.HexColor('#F8FAFC')
        ALT_ROW = colors.HexColor('#F1F5FF')
        RED = colors.HexColor('#EF4444')
        GREEN = colors.HexColor('#22C55E')
        AMBER = colors.HexColor('#F59E0B')

        styles = getSampleStyleSheet()
        style_company = ParagraphStyle('Company', fontSize=9, textColor=GRAY, alignment=TA_CENTER)
        style_title = ParagraphStyle('Title', fontSize=18, textColor=BRAND_DARK, fontName='Helvetica-Bold', alignment=TA_CENTER, spaceAfter=4)
        style_subtitle = ParagraphStyle('Subtitle', fontSize=10, textColor=GRAY, alignment=TA_CENTER, spaceAfter=2)
        style_section = ParagraphStyle('Section', fontSize=12, textColor=BRAND_DARK, fontName='Helvetica-Bold', spaceBefore=12, spaceAfter=6)
        style_note = ParagraphStyle('Note', fontSize=8, textColor=GRAY, alignment=TA_LEFT)
        style_cell = ParagraphStyle('Cell', fontSize=8, leading=10)
        style_cell_right = ParagraphStyle('CellR', fontSize=8, leading=10, alignment=TA_RIGHT)

        def fmt_rm(val):
            try:
                return f'RM {float(val):,.2f}'
            except Exception:
                return str(val)

        def fmt_pct(val):
            try:
                return f'{float(val):.1f}%'
            except Exception:
                return str(val)

        def build_table_style(num_rows, has_totals=False):
            style = [
                ('BACKGROUND', (0, 0), (-1, 0), BRAND),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 9),
                ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1 if not has_totals else -2), [colors.white, ALT_ROW]),
                ('FONTSIZE', (0, 1), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
                ('LEFTPADDING', (0, 0), (-1, -1), 6),
                ('RIGHTPADDING', (0, 0), (-1, -1), 6),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ]
            if has_totals:
                style += [
                    ('BACKGROUND', (0, -1), (-1, -1), BRAND_LIGHT),
                    ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
                    ('LINEABOVE', (0, -1), (-1, -1), 1.0, BRAND),
                ]
            return TableStyle(style)

        def page_footer(canvas, doc):
            canvas.saveState()
            canvas.setFont('Helvetica', 7)
            canvas.setFillColor(GRAY)
            w, h = doc.pagesize
            canvas.drawString(doc.leftMargin, 1.2 * cm, 'CONFIDENTIAL — ALTEL Group | ProTracker System')
            canvas.drawRightString(w - doc.rightMargin, 1.2 * cm, f'Page {doc.page}  |  Generated: {generated_at}')
            canvas.restoreState()

        story = []

        # Header block
        story.append(Paragraph('ALTEL GROUP OF COMPANIES', style_company))
        story.append(Spacer(1, 4))
        story.append(HRFlowable(width='100%', thickness=2, color=BRAND))
        story.append(Spacer(1, 6))

        title_map = {
            'overview': 'Projects Overview Report',
            'budget': 'Budget Analysis Report (RM)',
            'time': 'Time Tracking Report',
            'team': 'Team Productivity Report',
            'workload': 'Workload Distribution Report',
        }
        story.append(Paragraph(title_map.get(report_type, 'Project Report'), style_title))
        story.append(Paragraph(f'Generated on {generated_at}', style_subtitle))

        # Filter summary
        filter_parts = []
        if filters.get('status'): filter_parts.append(f"Status: {filters['status']}")
        if filters.get('pillar'): filter_parts.append(f"Pillar: {filters['pillar']}")
        if filters.get('date_from'): filter_parts.append(f"From: {filters['date_from']}")
        if filters.get('date_to'): filter_parts.append(f"To: {filters['date_to']}")
        if filter_parts:
            story.append(Spacer(1, 4))
            story.append(Paragraph('Filters applied: ' + '  |  '.join(filter_parts), style_note))
        story.append(Spacer(1, 10))
        story.append(HRFlowable(width='100%', thickness=0.5, color=colors.HexColor('#E2E8F0')))
        story.append(Spacer(1, 10))

        if report_type == 'budget':
            story.append(Paragraph('Total Contract Value (TCV) Summary by Project', style_section))
            projects = self._get_projects_qs(filters).filter(tcv__isnull=False)
            total_tcv = sum(float(p.tcv or 0) for p in projects)

            # Summary KPI row
            kpi_data = [
                ['TOTAL TCV', 'PROJECTS WITH TCV', 'TOTAL PROJECTS'],
                [fmt_rm(total_tcv), str(projects.count()), str(self._get_projects_qs(filters).count())],
            ]
            kpi_table = Table(kpi_data, colWidths=[None, None, None], hAlign='CENTER')
            kpi_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), BRAND_DARK),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 8),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('BACKGROUND', (0, 1), (-1, 1), BRAND_LIGHT),
                ('FONTNAME', (0, 1), (-1, 1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 1), (-1, 1), 11),
                ('TEXTCOLOR', (0, 1), (-1, 1), BRAND_DARK),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ]))
            story.append(kpi_table)
            story.append(Spacer(1, 14))

            # Detail table
            headers = ['#', 'Project Title', 'Pillar', 'Status', 'Progress', 'TCV (RM)', 'Year']
            col_widths_budget = [1*cm, 7*cm, 3.5*cm, 2.2*cm, 1.8*cm, 3.5*cm, 1.8*cm]
            rows = [headers]
            for idx, p in enumerate(projects, 1):
                tcv_val = float(p.tcv or 0)
                yr = str(p.start_date.year) if p.start_date else '—'
                rows.append([
                    str(idx),
                    Paragraph(p.title, style_cell),
                    p.pillar or '—',
                    p.status,
                    fmt_pct(p.progress_percent),
                    Paragraph(fmt_rm(tcv_val), style_cell_right),
                    yr,
                ])

            rows.append([
                '', Paragraph('<b>TOTALS</b>', style_cell),
                '', '', '',
                Paragraph(f'<b>{fmt_rm(total_tcv)}</b>', style_cell_right),
                '',
            ])

            tbl = Table(rows, colWidths=col_widths_budget, repeatRows=1)
            tbl.setStyle(build_table_style(len(rows) - 1, has_totals=True))
            tbl.setStyle(TableStyle([('ALIGN', (5, 1), (5, -1), 'RIGHT')]))
            story.append(tbl)

        elif report_type == 'overview':
            story.append(Paragraph('All Projects Summary', style_section))
            projects = self._get_projects_qs(filters)

            columns = filters.get('columns') or ['title', 'status', 'priority', 'start_date', 'end_date', 'progress']
            col_label = {
                'title': 'Project Title', 'status': 'Status', 'priority': 'Priority',
                'start_date': 'Start Date', 'end_date': 'End Date', 'progress': 'Progress',
                'tcv': 'TCV (RM)', 'health': 'Health',
            }
            active_cols = [c for c in columns if c in col_label]
            headers = ['#'] + [col_label[c] for c in active_cols]
            widths_map = {
                'title': 7 * cm, 'status': 2.5 * cm, 'priority': 2 * cm,
                'start_date': 2.5 * cm, 'end_date': 2.5 * cm, 'progress': 2 * cm,
                'tcv': 3 * cm, 'health': 2 * cm,
            }
            col_widths_ov = [1 * cm] + [widths_map.get(c, 2.5 * cm) for c in active_cols]

            rows = [headers]
            for idx, p in enumerate(projects, 1):
                row = [str(idx)]
                for col in active_cols:
                    if col == 'title': row.append(Paragraph(p.title, style_cell))
                    elif col == 'status': row.append(p.status)
                    elif col == 'priority': row.append(p.priority)
                    elif col == 'start_date': row.append(str(p.start_date or '—'))
                    elif col == 'end_date': row.append(str(p.end_date or '—'))
                    elif col == 'progress': row.append(fmt_pct(p.progress_percent))
                    elif col == 'tcv': row.append(Paragraph(fmt_rm(float(p.tcv or 0)) if p.tcv is not None else '—', style_cell_right))
                    elif col == 'health': row.append(fmt_pct(p.health_score))
                    else: row.append('')
                rows.append(row)

            tbl = Table(rows, colWidths=col_widths_ov, repeatRows=1)
            tbl.setStyle(build_table_style(len(rows)))
            story.append(tbl)
            story.append(Spacer(1, 6))
            story.append(Paragraph(f'Total projects: {projects.count()}', style_note))

        elif report_type == 'team':
            from django.contrib.auth import get_user_model
            from apps.tasks.models import Task, TimeLog
            User = get_user_model()
            story.append(Paragraph('Team Productivity Summary', style_section))
            users = User.objects.filter(is_approved=True)

            headers = ['#', 'Full Name', 'Username', 'Assigned', 'Completed', 'Overdue', 'Hours Logged', 'Rate']
            col_widths_team = [1*cm, 5.5*cm, 3.5*cm, 2*cm, 2.5*cm, 2*cm, 2.5*cm, 2.5*cm]
            rows = [headers]
            for idx, user in enumerate(users, 1):
                assigned = Task.objects.filter(assigned_to=user).count()
                completed = Task.objects.filter(assigned_to=user, status='DONE').count()
                overdue = Task.objects.filter(assigned_to=user, due_date__lt=tz.now().date()).exclude(status__in=['DONE', 'CANCELLED']).count()
                hours = TimeLog.objects.filter(user=user).aggregate(t=Sum('hours_logged'))['t'] or 0
                rate = round((completed / assigned * 100), 1) if assigned > 0 else 0
                rows.append([
                    str(idx), user.get_full_name() or user.username, user.username,
                    str(assigned), str(completed), str(overdue),
                    f'{float(hours):.1f}h', fmt_pct(rate),
                ])
            tbl = Table(rows, colWidths=col_widths_team, repeatRows=1)
            tbl.setStyle(build_table_style(len(rows)))
            story.append(tbl)

        elif report_type == 'time':
            from apps.tasks.models import Task, TimeLog
            story.append(Paragraph('Time Tracking — By Project', style_section))
            by_project = TimeLog.objects.values(
                'task__project__title'
            ).annotate(total_hours=Sum('hours_logged')).order_by('-total_hours')

            headers = ['#', 'Project', 'Total Hours Logged']
            col_widths_time = [1*cm, 11*cm, 4.5*cm]
            rows = [headers]
            for idx, row in enumerate(by_project, 1):
                rows.append([str(idx), row.get('task__project__title') or '—', f'{float(row["total_hours"] or 0):.1f}h'])
            tbl = Table(rows, colWidths=col_widths_time, repeatRows=1)
            tbl.setStyle(build_table_style(len(rows)))
            story.append(tbl)

            story.append(Spacer(1, 14))
            story.append(Paragraph('Time Tracking — By Team Member', style_section))
            by_user = TimeLog.objects.values(
                'user__username', 'user__first_name', 'user__last_name'
            ).annotate(total_hours=Sum('hours_logged')).order_by('-total_hours')
            headers2 = ['#', 'Team Member', 'Total Hours Logged']
            rows2 = [headers2]
            for idx, row in enumerate(by_user, 1):
                name = f"{row.get('user__first_name','')} {row.get('user__last_name','')}".strip() or row.get('user__username', '')
                rows2.append([str(idx), name, f'{float(row["total_hours"] or 0):.1f}h'])
            tbl2 = Table(rows2, colWidths=[1*cm, 11*cm, 4.5*cm], repeatRows=1)
            tbl2.setStyle(build_table_style(len(rows2)))
            story.append(tbl2)

        elif report_type == 'workload':
            from django.contrib.auth import get_user_model
            from apps.tasks.models import Task
            User = get_user_model()
            story.append(Paragraph('Workload Distribution', style_section))
            users = User.objects.filter(is_approved=True)

            headers = ['#', 'Full Name', 'Active Tasks', 'Load Level']
            col_widths_wl = [1*cm, 8*cm, 4*cm, 4*cm]
            rows = [headers]
            for idx, user in enumerate(users, 1):
                active = Task.objects.filter(assigned_to=user).exclude(status__in=['DONE', 'CANCELLED']).count()
                level = 'High' if active > 10 else 'Medium' if active > 5 else 'Normal'
                rows.append([str(idx), user.get_full_name() or user.username, str(active), level])
            tbl = Table(rows, colWidths=col_widths_wl, repeatRows=1)
            tbl.setStyle(build_table_style(len(rows)))
            story.append(tbl)

        else:
            story.append(Paragraph('No data available for the selected report type.', styles['Normal']))

        story.append(Spacer(1, 20))
        story.append(HRFlowable(width='100%', thickness=0.5, color=colors.HexColor('#E2E8F0')))
        story.append(Spacer(1, 4))
        story.append(Paragraph('This report is automatically generated by ProTracker. For internal use only.', style_note))

        doc.build(story, onFirstPage=page_footer, onLaterPages=page_footer)
        buffer.seek(0)

        resp = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        resp['Content-Disposition'] = f'attachment; filename=altel_{report_type}_report_{tz.now().strftime("%Y%m%d")}.pdf'
        return resp


class CalendarEventsView(APIView):
    def get(self, request):
        month = request.query_params.get('month')
        events = []

        project_qs = Project.objects.exclude(status__in=['CANCELLED'])
        task_qs = Task.objects.exclude(status__in=['CANCELLED'])

        dt = None
        if month:
            from datetime import datetime
            dt = datetime.strptime(month, '%Y-%m')
            project_qs = project_qs.filter(
                Q(start_date__year=dt.year, start_date__month=dt.month) |
                Q(end_date__year=dt.year, end_date__month=dt.month)
            )
            task_qs = task_qs.filter(due_date__year=dt.year, due_date__month=dt.month)

        for p in project_qs:
            if p.end_date:
                events.append({
                    'id': f'pe-{p.id}', 'title': f'Deadline: {p.title}',
                    'date': str(p.end_date), 'type': 'deadline',
                    'color': '#ef4444', 'project_id': str(p.id)
                })

        for t in task_qs:
            if t.due_date:
                events.append({
                    'id': f't-{t.id}', 'title': t.title,
                    'date': str(t.due_date), 'type': 'task',
                    'color': '#6366f1', 'project_id': str(t.project_id),
                    'task_id': str(t.id)
                })

        from apps.projects.models import Milestone
        milestones = Milestone.objects.exclude(status='CANCELLED')
        if dt:
            milestones = milestones.filter(due_date__year=dt.year, due_date__month=dt.month)
        for m in milestones:
            if m.due_date:
                events.append({
                    'id': f'm-{m.id}', 'title': f'Milestone: {m.title}',
                    'date': str(m.due_date), 'type': 'milestone',
                    'color': '#8b5cf6', 'project_id': str(m.project_id)
                })

        # Custom events (meetings, etc.)
        from .models import CalendarCustomEvent
        custom_qs = CalendarCustomEvent.objects.all()
        if dt:
            custom_qs = custom_qs.filter(date__year=dt.year, date__month=dt.month)
        for ce in custom_qs:
            events.append({
                'id': str(ce.id), 'title': ce.title,
                'date': str(ce.date), 'type': ce.event_type,
                'color': ce.color, 'description': ce.description,
                'start_time': str(ce.start_time) if ce.start_time else None,
                'end_time': str(ce.end_time) if ce.end_time else None,
                'is_custom': True,
            })

        return Response(events)


class CalendarCustomEventListCreate(ListCreateAPIView):
    from .models import CalendarCustomEvent
    from .serializers import CalendarCustomEventSerializer
    queryset = CalendarCustomEvent.objects.all()
    serializer_class = CalendarCustomEventSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class CalendarCustomEventDelete(DestroyAPIView):
    from .models import CalendarCustomEvent
    queryset = CalendarCustomEvent.objects.all()


class ImportProjectFromExcel(APIView):
    """
    Parse an uploaded Excel file and return detected project fields.
    Supports smart header matching so supervisors can use any column naming convention.
    POST with multipart: file=<xlsx/xls file>
    Returns: list of parsed project dicts ready for creation.
    """
    parser_classes_override = None  # uses default DRF parsers

    # Mapping of recognised column header keywords → project field
    # Includes English, Malay (BM), and common mixed-language variants
    FIELD_ALIASES = {
        'title': [
            # English
            'project name', 'project title', 'title', 'name', 'project',
            # Malay
            'nama projek', 'nama project', 'tajuk projek', 'tajuk projek ict',
            'nama', 'tajuk', 'projek',
        ],
        'client_name': [
            # English
            'client', 'client name', 'company', 'customer', 'organisation', 'organization',
            'client / company', 'employer',
            # Malay
            'agensi', 'pelanggan', 'syarikat', 'syarikat pelanggan',
            'agensi / pelanggan', 'agensi pelanggan', 'kementerian',
            'jabatan pelanggan', 'pemilik projek', 'pemohon',
        ],
        'project_manager': [
            # English
            'project manager', 'manager', 'contact person', 'contact', 'pic',
            'person in charge', 'project lead', 'lead',
            # Malay
            'pengurus projek', 'pengurus', 'ketua projek', 'penyelaras projek',
            'pegawai projek', 'pegawai bertanggungjawab', 'ketua pasukan',
            'pengurus program', 'urus setia',
        ],
        'pillar': [
            # English
            'pillar', 'business pillar', 'category', 'division', 'unit', 'department',
            'sector', 'domain', 'vertical',
            # Malay
            'tiang', 'tiang ict', 'tiang strategik', 'teras', 'sektor',
            'kategori', 'bahagian', 'bidang', 'fokus', 'kluster',
        ],
        'description': [
            # English
            'description', 'scope', 'scope of works', 'scope of work',
            'details', 'brief', 'project description', 'objective', 'deliverable',
            # Malay
            'skop kerja', 'skop', 'skop projek', 'perihal', 'keterangan',
            'huraian', 'butiran', 'objektif', 'penerangan', 'ringkasan',
        ],
        'status': [
            # English
            'status', 'project status', 'state', 'current status',
            # Malay
            'status projek', 'status semasa', 'keadaan projek', 'keadaan',
            'situasi', 'tahap projek',
        ],
        'priority': [
            # English
            'priority', 'urgency', 'importance', 'priority level',
            # Malay
            'keutamaan', 'prioriti', 'tahap keutamaan', 'darjah keutamaan',
            'kepentingan',
        ],
        'start_date': [
            # English
            'start date', 'start', 'commencement date', 'begin date', 'from date',
            'kick-off date', 'kickoff', 'project start',
            # Malay
            'tarikh mula', 'tarikh permulaan', 'tarikh bermula',
            'tarikh mula projek', 'mula', 'bermula',
        ],
        'end_date': [
            # English
            'end date', 'end', 'completion date', 'deadline', 'due date',
            'to date', 'finish date', 'target date', 'expected completion',
            # Malay
            'tarikh tamat', 'tarikh siap', 'tarikh akhir', 'tarikh selesai',
            'tarikh tamat projek', 'tarikh habis', 'tarikh sasaran', 'tamat',
        ],
        'progress_percent': [
            # English
            'progress', 'completion', 'completed', 'percent', '%',
            'completion %', 'progress %', 'progress (%)', '% complete',
            'percentage', 'percent complete',
            # Malay
            'peratus siap', 'peratus siap (%)', 'peratus', 'siap (%)',
            'pencapaian', 'kemajuan', '% siap', 'peratusan siap',
        ],
        'tcv': [
            # English
            'tcv', 'total contract value', 'contract value', 'value', 'amount',
            'contract amount', 'value (rm)', 'tcv (rm)', 'total value',
            'total contract value (rm)', 'project value', 'contract sum',
            'project cost', 'budget',
            # Malay
            'nilai kontrak', 'nilai kontrak (rm)', 'jumlah kontrak',
            'nilai projek', 'kos projek', 'harga kontrak', 'jumlah nilai',
            'nilai', 'kontrak nilai', 'amaun kontrak',
        ],
    }

    STATUS_MAP = {
        # English
        'draft': 'DRAFT', 'new': 'DRAFT', 'pending': 'DRAFT',
        'ongoing': 'ONGOING', 'in progress': 'ONGOING', 'active': 'ONGOING',
        'in-progress': 'ONGOING', 'running': 'ONGOING', 'executing': 'ONGOING',
        'on hold': 'ON_HOLD', 'hold': 'ON_HOLD', 'on-hold': 'ON_HOLD',
        'paused': 'ON_HOLD', 'suspended': 'ON_HOLD',
        'completed': 'COMPLETED', 'done': 'COMPLETED', 'finished': 'COMPLETED',
        'complete': 'COMPLETED', 'closed': 'COMPLETED',
        'cancelled': 'CANCELLED', 'canceled': 'CANCELLED', 'dropped': 'CANCELLED',
        'terminated': 'CANCELLED',
        'expired': 'EXPIRED',
        # Malay
        'draf': 'DRAFT', 'baharu': 'DRAFT', 'belum mula': 'DRAFT',
        'sedang berjalan': 'ONGOING', 'dalam proses': 'ONGOING',
        'aktif': 'ONGOING', 'berjalan': 'ONGOING', 'dalam pelaksanaan': 'ONGOING',
        'ditangguhkan': 'ON_HOLD', 'tangguh': 'ON_HOLD', 'penangguhan': 'ON_HOLD',
        'digantung': 'ON_HOLD',
        'selesai': 'COMPLETED', 'siap': 'COMPLETED', 'tamat': 'COMPLETED',
        'telah siap': 'COMPLETED', 'sudah siap': 'COMPLETED',
        'dibatalkan': 'CANCELLED', 'batal': 'CANCELLED', 'tidak diteruskan': 'CANCELLED',
    }
    PRIORITY_MAP = {
        # English
        'low': 'LOW', 'minor': 'LOW',
        'medium': 'MEDIUM', 'med': 'MEDIUM', 'normal': 'MEDIUM', 'moderate': 'MEDIUM',
        'high': 'HIGH', 'major': 'HIGH',
        'critical': 'CRITICAL', 'urgent': 'CRITICAL', 'very high': 'CRITICAL',
        # Malay
        'rendah': 'LOW',
        'sederhana': 'MEDIUM', 'pertengahan': 'MEDIUM',
        'tinggi': 'HIGH',
        'kritikal': 'CRITICAL', 'mendesak': 'CRITICAL', 'genting': 'CRITICAL',
    }

    def _match_header(self, header: str) -> str | None:
        """Return the project field name for a given column header, or None.
        Uses exact match, substring match, then fuzzy match (difflib) as fallback.
        """
        from difflib import get_close_matches
        cleaned = header.strip().lower().replace('_', ' ')
        # 1. Exact match in alias list
        for field, aliases in self.FIELD_ALIASES.items():
            if cleaned in aliases:
                return field
        # 2. Substring: header contains alias or alias contains header
        for field, aliases in self.FIELD_ALIASES.items():
            for a in aliases:
                if a in cleaned or cleaned in a:
                    return field
        # 3. Fuzzy match using difflib across all aliases
        all_aliases = []
        alias_to_field = {}
        for field, aliases in self.FIELD_ALIASES.items():
            for a in aliases:
                all_aliases.append(a)
                alias_to_field[a] = field
        fuzzy = get_close_matches(cleaned, all_aliases, n=1, cutoff=0.72)
        if fuzzy:
            return alias_to_field[fuzzy[0]]
        return None

    def _parse_date(self, value) -> str | None:
        if value is None:
            return None
        if hasattr(value, 'strftime'):
            return value.strftime('%Y-%m-%d')
        s = str(value).strip()
        from datetime import datetime
        for fmt in ('%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y', '%m/%d/%Y', '%d %b %Y', '%d %B %Y'):
            try:
                return datetime.strptime(s, fmt).strftime('%Y-%m-%d')
            except ValueError:
                continue
        return None

    def _parse_number(self, value) -> float | None:
        if value is None:
            return None
        try:
            return float(str(value).replace(',', '').replace('RM', '').replace('rm', '').strip())
        except (ValueError, TypeError):
            return None

    def post(self, request):
        uploaded = request.FILES.get('file')
        if not uploaded:
            return Response({'error': 'No file uploaded.'}, status=status.HTTP_400_BAD_REQUEST)

        filename = uploaded.name.lower()
        if not (filename.endswith('.xlsx') or filename.endswith('.xls')):
            return Response({'error': 'Only .xlsx and .xls files are supported.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            import openpyxl
            from io import BytesIO
            wb = openpyxl.load_workbook(BytesIO(uploaded.read()), data_only=True)
            ws = wb.active
        except Exception as e:
            return Response({'error': f'Could not read Excel file: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            return Response({'error': 'Excel file is empty.'}, status=status.HTTP_400_BAD_REQUEST)

        # Find header row: first row with at least 2 non-empty cells that match known fields
        header_row_idx = 0
        col_map: dict[int, str] = {}
        for i, row in enumerate(rows[:10]):  # search first 10 rows for headers
            matched: dict[int, str] = {}
            for j, cell in enumerate(row):
                if cell is None:
                    continue
                field = self._match_header(str(cell))
                if field:
                    matched[j] = field
            if len(matched) >= 2:
                header_row_idx = i
                col_map = matched
                break

        if not col_map:
            return Response(
                {'error': 'Could not detect project columns. Please ensure your Excel has recognisable headers like: Project Name, Client, Pillar, Status, Start Date, TCV, etc.'},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY
            )

        projects = []
        unmatched_col_map: dict[int, str] = {}  # col_idx → original header name (unmatched)

        # Collect unmatched column indices and their header names
        header_row = rows[header_row_idx]
        for j, cell in enumerate(header_row):
            if cell and j not in col_map:
                unmatched_col_map[j] = str(cell).strip()

        for row in rows[header_row_idx + 1:]:
            # Skip fully empty rows
            if all(v is None or str(v).strip() == '' for v in row):
                continue

            proj: dict = {
                'title': '',
                'client_name': '',
                'project_manager': '',
                'pillar': '',
                'description': '',
                'status': 'DRAFT',
                'priority': 'MEDIUM',
                'start_date': None,
                'end_date': None,
                'progress_percent': 0,
                'tcv': None,
                'custom_fields': {},
            }
            for col_idx, field_name in col_map.items():
                if col_idx >= len(row):
                    continue
                raw = row[col_idx]
                if raw is None:
                    continue
                val = str(raw).strip() if not hasattr(raw, 'strftime') else raw

                if field_name == 'status':
                    proj['status'] = self.STATUS_MAP.get(str(val).lower(), 'DRAFT')
                elif field_name == 'priority':
                    proj['priority'] = self.PRIORITY_MAP.get(str(val).lower(), 'MEDIUM')
                elif field_name in ('start_date', 'end_date'):
                    proj[field_name] = self._parse_date(raw)
                elif field_name == 'progress_percent':
                    num = self._parse_number(val)
                    proj['progress_percent'] = int(min(100, max(0, num))) if num is not None else 0
                elif field_name == 'tcv':
                    proj['tcv'] = self._parse_number(val)
                else:
                    proj[field_name] = str(val)

            # Capture unmatched columns as custom_fields
            for col_idx, header_name in unmatched_col_map.items():
                if col_idx >= len(row):
                    continue
                raw = row[col_idx]
                if raw is None or str(raw).strip() == '':
                    continue
                proj['custom_fields'][header_name] = str(raw).strip()

            if proj.get('title'):
                projects.append(proj)

        if not projects:
            return Response(
                {'error': 'No valid project rows found. Ensure at least one row has a Project Name.'},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY
            )

        return Response({
            'detected_columns': list(col_map.values()),
            'unmatched_headers': list(unmatched_col_map.values()),
            'projects': projects,
            'count': len(projects),
        })


class BulkCreateProjectsFromExcel(APIView):
    """
    POST: Receive a list of pre-parsed project dicts and create them all.
    Body: { "projects": [...] }
    Returns per-project success/error result.
    """

    def post(self, request):
        projects_data = request.data.get('projects', [])
        if not projects_data or not isinstance(projects_data, list):
            return Response({'error': 'No projects data provided.'}, status=status.HTTP_400_BAD_REQUEST)

        from apps.projects.models import Project, Pillar
        from django.utils.text import slugify

        results = []
        created_count = 0
        failed_count = 0

        for idx, proj in enumerate(projects_data):
            title = str(proj.get('title', '')).strip()
            if not title:
                results.append({'index': idx, 'title': '(no title)', 'status': 'failed', 'error': 'Missing title'})
                failed_count += 1
                continue

            try:
                # Auto-create pillar if it doesn't exist
                pillar_name = str(proj.get('pillar', '')).strip()
                if pillar_name:
                    Pillar.objects.get_or_create(name=pillar_name)

                # Build slug
                base_slug = slugify(title)
                slug = base_slug
                n = 1
                while Project.objects.filter(slug=slug).exists():
                    slug = f"{base_slug}-{n}"
                    n += 1

                # Parse numeric fields safely
                def safe_int(v, default=0, lo=0, hi=100):
                    try:
                        return max(lo, min(hi, int(float(str(v)))))
                    except (TypeError, ValueError):
                        return default

                def safe_decimal(v):
                    if v is None:
                        return None
                    try:
                        from decimal import Decimal
                        return Decimal(str(v).replace(',', '').strip())
                    except Exception:
                        return None

                status_val = str(proj.get('status', 'DRAFT')).upper()
                valid_statuses = {s[0] for s in Project.Status.choices}
                if status_val not in valid_statuses:
                    status_val = 'DRAFT'

                priority_val = str(proj.get('priority', 'MEDIUM')).upper()
                valid_priorities = {p[0] for p in Project.Priority.choices}
                if priority_val not in valid_priorities:
                    priority_val = 'MEDIUM'

                def parse_date(v):
                    if not v or str(v).strip() in ('', 'None'):
                        return None
                    if hasattr(v, 'date'):
                        return v.date()
                    s = str(v).strip()
                    from datetime import datetime
                    for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y', '%m/%d/%Y', '%d %b %Y', '%d %B %Y'):
                        try:
                            return datetime.strptime(s, fmt).date()
                        except ValueError:
                            continue
                    return None

                custom_fields = proj.get('custom_fields', {})
                if not isinstance(custom_fields, dict):
                    custom_fields = {}

                p = Project.objects.create(
                    title=title,
                    slug=slug,
                    description=str(proj.get('description', '')),
                    pillar=pillar_name,
                    client_name=str(proj.get('client_name', '')),
                    project_manager=str(proj.get('project_manager', '')),
                    status=status_val,
                    priority=priority_val,
                    start_date=parse_date(proj.get('start_date')),
                    end_date=parse_date(proj.get('end_date')),
                    progress_percent=safe_int(proj.get('progress_percent', 0)),
                    tcv=safe_decimal(proj.get('tcv')),
                    custom_fields=custom_fields,
                    owner=request.user,
                    created_by=request.user,
                )

                # Log activity
                try:
                    from apps.comments.models import ActivityLog
                    ActivityLog.objects.create(
                        project=p,
                        actor=request.user,
                        action='created',
                        description=f'created project via Excel bulk import',
                    )
                except Exception:
                    pass

                results.append({
                    'index': idx,
                    'title': title,
                    'status': 'created',
                    'id': str(p.id),
                    'created_at': p.created_at.isoformat(),
                })
                created_count += 1

            except Exception as e:
                results.append({'index': idx, 'title': title, 'status': 'failed', 'error': str(e)})
                failed_count += 1

        return Response({
            'created': created_count,
            'failed': failed_count,
            'total': len(projects_data),
            'results': results,
        }, status=status.HTTP_201_CREATED if created_count > 0 else status.HTTP_400_BAD_REQUEST)

