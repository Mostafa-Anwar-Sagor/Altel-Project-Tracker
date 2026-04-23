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
        projects = Project.objects.all()
        today = timezone.now().date()

        status_counts = {}
        for s in Project.Status.choices:
            status_counts[s[0].lower()] = projects.filter(status=s[0]).count()

        priority_counts = {}
        for p in Project.Priority.choices:
            priority_counts[p[0].lower()] = projects.filter(priority=p[0]).count()

        return Response({
            'total': projects.count(),
            'by_status': status_counts,
            'by_priority': priority_counts,
            'overdue': projects.filter(
                end_date__lt=today
            ).exclude(status__in=['COMPLETED', 'CANCELLED', 'EXPIRED']).count(),
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
    def get(self, request):
        projects = Project.objects.exclude(status__in=['CANCELLED']).values(
            'id', 'title', 'budget_total', 'budget_spent', 'progress_percent', 'status'
        )

        data = []
        for p in projects:
            total = float(p['budget_total'] or 0)
            spent = float(p['budget_spent'] or 0)
            data.append({
                **p,
                'budget_total': total,
                'budget_spent': spent,
                'budget_remaining': total - spent,
                'budget_usage_pct': round((spent / total * 100), 1) if total > 0 else 0,
                'is_over_budget': spent > total,
            })

        return Response({
            'projects': data,
            'totals': {
                'total_budget': sum(d['budget_total'] for d in data),
                'total_spent': sum(d['budget_spent'] for d in data),
                'total_remaining': sum(d['budget_remaining'] for d in data),
            }
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
            ws.title = 'Budget Report'
            ws.merge_cells('A1:H1')
            ws['A1'] = 'ALTEL PROJECT TRACKER — Budget Report (RM)'
            ws['A1'].font = title_font
            ws['A1'].alignment = center
            ws.merge_cells('A2:H2')
            ws['A2'] = f'Generated: {generated_at}'
            ws['A2'].font = Font(italic=True, color='64748B', size=9)
            ws['A2'].alignment = center
            ws.row_dimensions[1].height = 28
            ws.row_dimensions[2].height = 16

            headers = ['#', 'Project Title', 'Status', 'Progress (%)', 'Budget (RM)', 'Spent (RM)', 'Remaining (RM)', 'Usage (%)']
            for i, h in enumerate(headers, 1):
                ws.cell(row=4, column=i, value=h)
            style_header_row(ws, 4, len(headers))

            projects = self._get_projects_qs(filters)
            for idx, p in enumerate(projects, 1):
                row = idx + 4
                total = float(p.budget_total or 0)
                spent = float(p.budget_spent or 0)
                remaining = total - spent
                usage = round((spent / total * 100), 1) if total > 0 else 0
                status_label = p.get_status_display() if hasattr(p, 'get_status_display') else p.status
                ws.cell(row=row, column=1, value=idx)
                ws.cell(row=row, column=2, value=p.title)
                ws.cell(row=row, column=3, value=status_label)
                ws.cell(row=row, column=4, value=p.progress_percent)
                ws.cell(row=row, column=5, value=total).number_format = rm_fmt
                ws.cell(row=row, column=6, value=spent).number_format = rm_fmt
                ws.cell(row=row, column=7, value=remaining).number_format = rm_fmt
                ws.cell(row=row, column=8, value=usage)
                for c in [5, 6, 7]:
                    ws.cell(row=row, column=c).number_format = rm_fmt
                style_data_row(ws, row, len(headers), alt=(idx % 2 == 0))
                ws.cell(row=row, column=4).alignment = center
                ws.cell(row=row, column=8).alignment = center

            # Totals row
            total_row = projects.count() + 5
            ws.cell(row=total_row, column=2, value='TOTALS').font = Font(bold=True)
            ws.cell(row=total_row, column=5, value=sum(float(p.budget_total or 0) for p in projects)).number_format = rm_fmt
            ws.cell(row=total_row, column=5).font = Font(bold=True)
            ws.cell(row=total_row, column=6, value=sum(float(p.budget_spent or 0) for p in projects)).number_format = rm_fmt
            ws.cell(row=total_row, column=6).font = Font(bold=True)
            ws.cell(row=total_row, column=7, value=sum(float((p.budget_total or 0) - (p.budget_spent or 0)) for p in projects)).number_format = rm_fmt
            ws.cell(row=total_row, column=7).font = Font(bold=True)
            for c in range(1, len(headers) + 1):
                ws.cell(row=total_row, column=c).fill = PatternFill('solid', fgColor='DBEAFE')
                ws.cell(row=total_row, column=c).border = border

            col_widths = [5, 40, 14, 14, 18, 18, 18, 12]
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
                'budget': 'Budget (RM)', 'spent': 'Spent (RM)', 'health': 'Health Score',
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
                    elif col == 'budget':
                        cell = ws.cell(row=row, column=ci, value=float(p.budget_total or 0))
                        cell.number_format = rm_fmt
                        continue
                    elif col == 'spent':
                        cell = ws.cell(row=row, column=ci, value=float(p.budget_spent or 0))
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
            headers = ['#', 'Title', 'Status', 'Priority', 'Start Date', 'End Date', 'Progress (%)', 'Budget (RM)']
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
                cell = ws.cell(row=row, column=8, value=float(p.budget_total or 0))
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
            story.append(Paragraph('Budget Summary by Project', style_section))
            projects = self._get_projects_qs(filters)
            total_budget = sum(float(p.budget_total or 0) for p in projects)
            total_spent = sum(float(p.budget_spent or 0) for p in projects)
            total_remaining = total_budget - total_spent

            # Summary KPI row
            kpi_data = [
                ['TOTAL BUDGET', 'TOTAL SPENT', 'TOTAL REMAINING', 'OVERALL USAGE'],
                [fmt_rm(total_budget), fmt_rm(total_spent), fmt_rm(total_remaining),
                 f'{(total_spent/total_budget*100):.1f}%' if total_budget > 0 else '0.0%'],
            ]
            kpi_table = Table(kpi_data, colWidths=[None, None, None, None], hAlign='CENTER')
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
            headers = ['#', 'Project Title', 'Status', 'Progress', 'Budget (RM)', 'Spent (RM)', 'Remaining (RM)', 'Usage']
            col_widths_budget = [1*cm, 7*cm, 2.2*cm, 1.8*cm, 3.2*cm, 3.2*cm, 3.2*cm, 1.8*cm]
            rows = [headers]
            for idx, p in enumerate(projects, 1):
                total = float(p.budget_total or 0)
                spent = float(p.budget_spent or 0)
                remaining = total - spent
                usage = round((spent / total * 100), 1) if total > 0 else 0
                over = spent > total
                rows.append([
                    str(idx),
                    Paragraph(p.title, style_cell),
                    p.status,
                    fmt_pct(p.progress_percent),
                    Paragraph(fmt_rm(total), style_cell_right),
                    Paragraph(fmt_rm(spent), style_cell_right),
                    Paragraph(fmt_rm(remaining), style_cell_right),
                    fmt_pct(usage),
                ])

            rows.append([
                '', Paragraph('<b>TOTALS</b>', style_cell),
                '', '',
                Paragraph(f'<b>{fmt_rm(total_budget)}</b>', style_cell_right),
                Paragraph(f'<b>{fmt_rm(total_spent)}</b>', style_cell_right),
                Paragraph(f'<b>{fmt_rm(total_remaining)}</b>', style_cell_right),
                fmt_pct((total_spent / total_budget * 100) if total_budget > 0 else 0),
            ])

            tbl = Table(rows, colWidths=col_widths_budget, repeatRows=1)
            tbl.setStyle(build_table_style(len(rows) - 1, has_totals=True))
            # Right-align currency columns
            for col in [4, 5, 6]:
                tbl.setStyle(TableStyle([('ALIGN', (col, 1), (col, -1), 'RIGHT')]))
            story.append(tbl)

        elif report_type == 'overview':
            story.append(Paragraph('All Projects Summary', style_section))
            projects = self._get_projects_qs(filters)

            columns = filters.get('columns') or ['title', 'status', 'priority', 'start_date', 'end_date', 'progress']
            col_label = {
                'title': 'Project Title', 'status': 'Status', 'priority': 'Priority',
                'start_date': 'Start Date', 'end_date': 'End Date', 'progress': 'Progress',
                'budget': 'Budget (RM)', 'spent': 'Spent (RM)', 'health': 'Health',
            }
            active_cols = [c for c in columns if c in col_label]
            headers = ['#'] + [col_label[c] for c in active_cols]
            widths_map = {
                'title': 7 * cm, 'status': 2.5 * cm, 'priority': 2 * cm,
                'start_date': 2.5 * cm, 'end_date': 2.5 * cm, 'progress': 2 * cm,
                'budget': 3 * cm, 'spent': 3 * cm, 'health': 2 * cm,
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
                    elif col == 'budget': row.append(Paragraph(fmt_rm(float(p.budget_total or 0)), style_cell_right))
                    elif col == 'spent': row.append(Paragraph(fmt_rm(float(p.budget_spent or 0)), style_cell_right))
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
