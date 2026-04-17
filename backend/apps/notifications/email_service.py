"""Email sending utility that reads SMTP config from the database.
Sends professional branded HTML + plain-text emails.
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Brand colours
# ---------------------------------------------------------------------------
BRAND_PRIMARY = '#4F46E5'
BRAND_BG      = '#F8FAFC'
BRAND_TEXT    = '#1E293B'
BRAND_MUTED   = '#64748B'
BRAND_BORDER  = '#E2E8F0'


def _build_html(subject: str, body_text: str) -> str:
    """Wrap plain-text body in a responsive branded HTML template."""
    body_html = body_text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    body_html = body_html.replace('\n', '<br>')
    year = timezone.now().year
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{subject}</title>
  <style>
    body{{margin:0;padding:0;background:{BRAND_BG};font-family:'Segoe UI',Arial,sans-serif;}}
    .wrapper{{max-width:620px;margin:32px auto;background:#fff;border-radius:12px;
              border:1px solid {BRAND_BORDER};box-shadow:0 4px 24px rgba(0,0,0,.06);overflow:hidden;}}
    .hdr{{background:{BRAND_PRIMARY};padding:28px 32px;}}
    .hdr-logo{{font-size:22px;font-weight:700;color:#fff;letter-spacing:-.5px;}}
    .hdr-logo span{{opacity:.75;font-weight:400;}}
    .hdr-sub{{margin-top:4px;font-size:13px;color:rgba(255,255,255,.75);}}
    .bdy{{padding:32px;}}
    .badge{{display:inline-block;background:#EEF2FF;color:{BRAND_PRIMARY};font-size:11px;
            font-weight:600;text-transform:uppercase;letter-spacing:.6px;
            padding:4px 10px;border-radius:20px;margin-bottom:18px;}}
    .content{{font-size:15px;line-height:1.75;color:{BRAND_TEXT};}}
    .ftr{{background:{BRAND_BG};padding:20px 32px;text-align:center;
          font-size:12px;color:{BRAND_MUTED};border-top:1px solid {BRAND_BORDER};}}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="hdr">
      <div class="hdr-logo">ProTracker <span>by ALTEL</span></div>
      <div class="hdr-sub">Project Management &amp; Notification System</div>
    </div>
    <div class="bdy">
      <div class="badge">ProTracker Notification</div>
      <div class="content">{body_html}</div>
    </div>
    <div class="ftr">
      <p style="margin:0 0 4px;">You are receiving this because you are a member of a project in ProTracker.</p>
      <p style="margin:0;">&copy; {year} ALTEL &nbsp;&middot;&nbsp; ProTracker &nbsp;&middot;&nbsp; All rights reserved</p>
    </div>
  </div>
</body>
</html>"""


def _get_role_content(role: str, months_str: str) -> dict:
    """Return role-specific email content (intro, focus, cta, role_label)."""
    content = {
        'SALES_MANAGER': {
            'role_label': 'Sales Manager',
            'role_full': 'Sales Manager',
            'intro': (
                f'As the <strong>Sales Manager</strong> responsible for this engagement, '
                f'please be advised that the project deadline is approaching in approximately '
                f'<strong>{months_str}</strong>. Your oversight is required to ensure all commercial '
                f'obligations and revenue targets are met on schedule.'
            ),
            'focus': (
                'Kindly review the following: the current sales objectives and achievement status, '
                'all client agreements and commercial commitments, any outstanding contractual obligations, '
                'and ensure all relevant stakeholders have been briefed and are aligned with the '
                'project timeline. Any risks or blockers should be escalated immediately.'
            ),
            'cta': 'Log in to ProTracker, navigate to this project, and verify all sales milestones are on track',
        },
        'ACCOUNT_MANAGER': {
            'role_label': 'Account Manager',
            'role_full': 'Account Manager',
            'intro': (
                f'As the <strong>Account Manager</strong> and primary point of contact for this project, '
                f'you are hereby notified that the contract deadline is in approximately '
                f'<strong>{months_str}</strong>. Immediate attention is required to confirm all '
                f'deliverables are on track and client commitments will be fulfilled on time.'
            ),
            'focus': (
                'Please ensure the following items are reviewed and addressed without delay: '
                'all contractual deliverables and SLA compliance, key performance indicators (KPIs) '
                'and their current achievement levels, outstanding client commitments or unresolved issues, '
                'and coordination with internal teams to resolve any bottlenecks. '
                'Any deviations from the agreed scope must be formally documented and communicated.'
            ),
            'cta': 'Log in to ProTracker to review deliverables, update milestones, and confirm client commitments',
        },
        'PRESALES': {
            'role_label': 'Presales Engineer',
            'role_full': 'Presales Engineer',
            'intro': (
                f'As the <strong>Presales Engineer</strong> associated with this project, '
                f'please be informed that the project deadline is approximately '
                f'<strong>{months_str}</strong> away. Your action is required to ensure all '
                f'technical handover responsibilities are completed in preparation for project closure.'
            ),
            'focus': (
                'Please review and confirm the completion of the following: all technical specifications '
                'and solution design documents, bill of materials (BOM) and configuration documentation, '
                'knowledge transfer and handover materials for the delivery team, '
                'and any outstanding technical queries or clarifications from the client. '
                'Ensure all presales documentation is filed and accessible in the project repository.'
            ),
            'cta': 'Log in to ProTracker to verify technical documentation and complete presales handover tasks',
        },
        'ADMIN': {
            'role_label': 'System Administrator',
            'role_full': 'System Administrator',
            'intro': (
                f'This automated notification is to inform you that a project under your administration '
                f'has a deadline approaching in approximately <strong>{months_str}</strong>. '
                f'A full project review is required to ensure all teams are on track and '
                f'all decisions can be escalated through you as required.'
            ),
            'focus': (
                'As System Administrator, please review the overall project health, including: '
                'current progress percentage and milestone completion status, '
                'action items assigned to each role (Sales Manager, Account Manager, Presales Engineer), '
                'any unresolved blockers or escalations, and whether the project requires a timeline '
                'adjustment or management intervention. This is a Stage-based reminder and further '
                'notifications will be issued at each subsequent stage until the deadline.'
            ),
            'cta': 'Log in to ProTracker to review the full project dashboard and coordinate with all stakeholders',
        },
    }
    return content.get(role, content['ADMIN'])


def _build_reminder_html_for_user(user, project, stage: int, months_left: int) -> str:
    """Build a personalised, role-based official HTML reminder email."""
    stage_colours = {1: '#10B981', 2: '#F59E0B', 3: '#F97316', 4: '#EF4444'}
    stage_labels  = {
        1: 'Early Notice',
        2: 'Upcoming Deadline',
        3: 'Deadline Alert',
        4: 'Critical — Immediate Action Required',
    }
    colour    = stage_colours.get(stage, BRAND_PRIMARY)
    label     = stage_labels.get(stage, 'Reminder')
    progress  = getattr(project, 'progress_percent', 0)
    year      = timezone.now().year
    months_str = f'{months_left} month{"s" if months_left != 1 else ""}'
    today_str  = timezone.now().strftime('%d %B %Y')

    manager_name = (project.manager.get_full_name() or project.manager.username) if project.manager else 'N/A'
    user_name    = user.get_full_name() or user.username
    role         = getattr(user, 'role', 'ADMIN')
    rc           = _get_role_content(role, months_str)

    stage_dots = ''.join(
        f'<div style="flex:1;height:8px;border-radius:99px;'
        f'background:{colour if i <= stage else BRAND_BORDER};"></div>'
        for i in range(1, 5)
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Official Project Expiry Notification — Stage {stage} of 4</title>
  <style>
    body{{margin:0;padding:0;background:#F1F5F9;font-family:'Segoe UI',Arial,sans-serif;}}
    .wrap{{max-width:640px;margin:32px auto;background:#fff;border-radius:0;
           border-top:4px solid {colour};box-shadow:0 2px 16px rgba(0,0,0,.08);overflow:hidden;}}
    .hdr{{background:{BRAND_PRIMARY};padding:24px 36px;display:flex;align-items:center;justify-content:space-between;}}
    .hdr-left{{color:#fff;}}
    .hdr-logo{{font-size:20px;font-weight:700;letter-spacing:-.3px;margin:0;}}
    .hdr-logo span{{opacity:.7;font-weight:400;font-size:18px;}}
    .hdr-tagline{{font-size:11px;color:rgba(255,255,255,.65);margin-top:3px;letter-spacing:.3px;text-transform:uppercase;}}
    .hdr-date{{font-size:11px;color:rgba(255,255,255,.6);text-align:right;}}
    .alert-bar{{background:{colour};padding:10px 36px;display:flex;align-items:center;gap:10px;}}
    .alert-bar-text{{color:#fff;font-size:13px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;}}
    .bdy{{padding:36px;}}
    .ref-line{{font-size:11px;color:{BRAND_MUTED};border-bottom:1px solid {BRAND_BORDER};padding-bottom:14px;margin-bottom:22px;letter-spacing:.2px;}}
    .greeting{{font-size:15px;line-height:1.8;color:{BRAND_TEXT};margin:0 0 20px;}}
    .section-title{{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:{BRAND_MUTED};margin:24px 0 8px;}}
    .project-card{{border:1px solid {BRAND_BORDER};border-left:4px solid {colour};border-radius:6px;padding:16px 20px;margin:0 0 20px;}}
    .project-name{{font-size:18px;font-weight:700;color:{BRAND_TEXT};margin:0 0 4px;}}
    .project-meta{{font-size:12.5px;color:{BRAND_MUTED};}}
    table.info{{width:100%;border-collapse:collapse;margin:0 0 20px;}}
    table.info tr td{{padding:10px 0;font-size:13.5px;border-bottom:1px solid {BRAND_BORDER};vertical-align:top;}}
    table.info tr:last-child td{{border-bottom:none;}}
    table.info td:first-child{{width:38%;font-weight:600;color:{BRAND_TEXT};padding-right:12px;}}
    table.info td:last-child{{color:{BRAND_MUTED};}}
    .prog-wrap{{margin-top:5px;}}
    .prog-bg{{background:#E2E8F0;border-radius:99px;height:7px;overflow:hidden;}}
    .prog-fill{{height:7px;border-radius:99px;background:{colour};width:{progress}%;}}
    .prog-pct{{font-size:12px;color:{BRAND_MUTED};margin-top:3px;}}
    .countdown-box{{background:{colour}0F;border:1px solid {colour}30;border-radius:8px;
                    padding:18px 24px;margin:20px 0;display:flex;align-items:center;gap:20px;}}
    .countdown-num{{font-size:42px;font-weight:800;color:{colour};line-height:1;flex-shrink:0;}}
    .countdown-text{{font-size:13.5px;color:{BRAND_TEXT};line-height:1.6;}}
    .stage-track{{margin:20px 0 6px;}}
    .stage-labels{{display:flex;justify-content:space-between;font-size:10px;color:{BRAND_MUTED};margin-top:4px;}}
    .action-box{{background:#FAFAFA;border:1px solid {BRAND_BORDER};border-left:4px solid {BRAND_PRIMARY};
                 border-radius:0 6px 6px 0;padding:18px 20px;margin:20px 0;line-height:1.8;}}
    .action-box-title{{font-size:13px;font-weight:700;color:{BRAND_TEXT};margin-bottom:8px;}}
    .action-box-body{{font-size:13.5px;color:{BRAND_MUTED};}}
    .action-cta{{font-size:13px;color:{BRAND_PRIMARY};font-weight:600;margin-top:10px;}}
    .disclaimer{{font-size:12px;color:{BRAND_MUTED};background:#F8FAFC;border:1px solid {BRAND_BORDER};
                 border-radius:6px;padding:12px 16px;margin-top:24px;line-height:1.7;}}
    .ftr{{background:#F1F5F9;padding:20px 36px;border-top:1px solid {BRAND_BORDER};}}
    .ftr-top{{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;}}
    .ftr-brand{{font-size:13px;font-weight:700;color:{BRAND_TEXT};}}
    .ftr-brand span{{font-weight:400;color:{BRAND_MUTED};}}
    .ftr-copy{{font-size:11px;color:{BRAND_MUTED};text-align:right;line-height:1.6;}}
    .ftr-legal{{font-size:11px;color:{BRAND_MUTED};border-top:1px solid {BRAND_BORDER};padding-top:10px;line-height:1.6;}}
  </style>
</head>
<body>
  <div class="wrap">

    <!-- Header -->
    <div class="hdr">
      <div class="hdr-left">
        <div class="hdr-logo">ProTracker <span>by ALTEL</span></div>
        <div class="hdr-tagline">Project Management &amp; Notification System</div>
      </div>
      <div class="hdr-date">{today_str}</div>
    </div>

    <!-- Alert bar -->
    <div class="alert-bar">
      <div class="alert-bar-text">&#9888;&nbsp; Official Notification &nbsp;|&nbsp; Stage {stage} of 4 &nbsp;|&nbsp; {label}</div>
    </div>

    <div class="bdy">

      <!-- Reference line -->
      <p class="ref-line">
        <strong>TO:</strong> {user_name} &nbsp;&middot;&nbsp;
        <strong>ROLE:</strong> {rc['role_full']} &nbsp;&middot;&nbsp;
        <strong>REF:</strong> PRT-{stage}{stage}-{str(project.id)[:8].upper() if project.id else 'N/A'}
      </p>

      <!-- Greeting -->
      <p class="greeting">
        Dear <strong>{user_name}</strong>,<br><br>
        {rc['intro']}
      </p>

      <!-- Project card -->
      <p class="section-title">Project Details</p>
      <div class="project-card">
        <div class="project-name">{project.title}</div>
        <div class="project-meta">Pillar: {project.pillar or 'N/A'} &nbsp;&middot;&nbsp; Status: {project.get_status_display() if hasattr(project, 'get_status_display') else project.status}</div>
      </div>

      <!-- Countdown -->
      <div class="countdown-box">
        <div class="countdown-num">~{months_left}</div>
        <div class="countdown-text">
          <strong>month{"s" if months_left != 1 else ""} remaining</strong> until the contractual project deadline.<br>
          Immediate attention is required to ensure timely completion.
        </div>
      </div>

      <!-- Stage progress track -->
      <div class="stage-track">
        <div style="display:flex;gap:6px;">{stage_dots}</div>
        <div class="stage-labels">
          <span>Early Notice</span><span>Upcoming</span><span>Deadline Alert</span><span>Critical</span>
        </div>
      </div>
      <p style="font-size:11px;color:{BRAND_MUTED};margin:4px 0 20px;">
        This is Reminder <strong>{stage} of 4</strong>. Subsequent reminders will be sent at each remaining stage.
      </p>

      <!-- Info table -->
      <p class="section-title">Project Information</p>
      <table class="info">
        <tr><td>Project Manager</td><td><strong>{manager_name}</strong></td></tr>
        <tr><td>Contract Deadline</td><td><strong style="color:{colour};font-size:15px;">{project.end_date}</strong></td></tr>
        <tr><td>Current Progress</td>
          <td>
            <div class="prog-wrap">
              <div class="prog-bg"><div class="prog-fill"></div></div>
              <div class="prog-pct">{progress}% complete</div>
            </div>
          </td>
        </tr>
        <tr><td>Notification Stage</td><td>{stage} of 4 &mdash; <em>{label}</em></td></tr>
      </table>

      <!-- Action required -->
      <p class="section-title">Action Required</p>
      <div class="action-box">
        <div class="action-box-title">Responsibilities of the {rc['role_full']}:</div>
        <div class="action-box-body">{rc['focus']}</div>
        <div class="action-cta">&#8594; {rc['cta']}.</div>
      </div>

      <!-- Disclaimer -->
      <div class="disclaimer">
        This is an <strong>official automated notification</strong> generated by the ALTEL ProTracker system.
        Please do not reply directly to this email. If you believe you have received this in error,
        contact your system administrator. All project activities must be logged and updated in ProTracker
        to maintain accurate records for management reporting.
      </div>

    </div>

    <!-- Footer -->
    <div class="ftr">
      <div class="ftr-top">
        <div class="ftr-brand">ProTracker <span>by ALTEL</span></div>
        <div class="ftr-copy">
          Sent to: {user.email or user_name}<br>
          Role: {rc['role_full']}
        </div>
      </div>
      <div class="ftr-legal">
        &copy; {year} ALTEL &nbsp;&middot;&nbsp; ProTracker Notification System &nbsp;&middot;&nbsp; All rights reserved.<br>
        You are receiving this notification because you are assigned to project
        <strong>{project.title}</strong> as <strong>{rc['role_full']}</strong>.
        This is a system-generated message. Do not reply.
      </div>
    </div>

  </div>
</body>
</html>"""


def _build_reminder_html(project, stage: int, months_left: int, recipients_count: int) -> str:
    """Legacy wrapper – builds a generic (non-personalised) reminder HTML.
    Kept for backward compatibility; prefer _build_reminder_html_for_user where possible.
    """
    stage_colours = {1: '#10B981', 2: '#F59E0B', 3: '#F97316', 4: '#EF4444'}
    stage_labels  = {1: 'Early Notice', 2: 'Upcoming Deadline', 3: 'Deadline Soon', 4: 'Critical – Action Required'}
    colour   = stage_colours.get(stage, BRAND_PRIMARY)
    label    = stage_labels.get(stage, 'Reminder')
    progress = getattr(project, 'progress_percent', 0)
    year     = timezone.now().year
    months_str = f'{months_left} month{"s" if months_left != 1 else ""}'
    manager_name = (project.manager.get_full_name() or project.manager.username) if project.manager else 'N/A'
    stage_dots = ''.join(
        f'<div style="flex:1;height:7px;border-radius:99px;'
        f'background:{colour if i <= stage else BRAND_BORDER};"></div>'
        for i in range(1, 5)
    )
    return f"""<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<title>Project Expiry Reminder – Stage {stage}/4</title>
<style>
body{{margin:0;padding:0;background:{BRAND_BG};font-family:'Segoe UI',Arial,sans-serif;}}
.wrap{{max-width:620px;margin:32px auto;background:#fff;border-radius:12px;
       border:1px solid {BRAND_BORDER};box-shadow:0 4px 24px rgba(0,0,0,.06);overflow:hidden;}}
.hdr{{background:{BRAND_PRIMARY};padding:28px 32px;}}
.hdr-logo{{font-size:22px;font-weight:700;color:#fff;}}
.hdr-logo span{{opacity:.75;font-weight:400;}}
.hdr-sub{{margin-top:4px;font-size:13px;color:rgba(255,255,255,.75);}}
.bdy{{padding:32px;}}
.badge{{display:inline-block;background:{colour}22;color:{colour};font-size:11px;font-weight:700;
        text-transform:uppercase;padding:5px 12px;border-radius:20px;border:1px solid {colour}44;margin-bottom:18px;}}
h2{{font-size:21px;font-weight:700;color:{BRAND_TEXT};margin:0 0 4px;}}
.sub{{font-size:13.5px;color:{BRAND_MUTED};margin:0 0 20px;}}
.countdown{{background:{colour}0D;border:1px solid {colour}33;border-radius:10px;padding:16px;margin:18px 0;text-align:center;}}
.countdown-num{{font-size:38px;font-weight:800;color:{colour};line-height:1;}}
.countdown-lbl{{font-size:13px;color:{BRAND_MUTED};margin-top:4px;}}
table.meta{{width:100%;border-collapse:collapse;margin:16px 0;}}
table.meta td{{padding:9px 0;font-size:13.5px;color:{BRAND_MUTED};border-bottom:1px solid {BRAND_BORDER};vertical-align:top;}}
table.meta td:first-child{{width:40%;font-weight:600;color:{BRAND_TEXT};padding-right:12px;}}
.prog-bg{{background:#E2E8F0;border-radius:99px;height:8px;margin-top:6px;overflow:hidden;}}
.prog-fill{{height:8px;border-radius:99px;background:{BRAND_PRIMARY};width:{progress}%;}}
.hint{{font-size:13.5px;color:{BRAND_TEXT};background:{colour}08;border-left:4px solid {colour};
       padding:14px 16px;border-radius:0 8px 8px 0;margin-top:22px;line-height:1.7;}}
.ftr{{background:{BRAND_BG};padding:20px 32px;text-align:center;font-size:12px;color:{BRAND_MUTED};border-top:1px solid {BRAND_BORDER};}}
</style></head><body>
<div class="wrap">
  <div class="hdr"><div class="hdr-logo">ProTracker <span>by ALTEL</span></div>
    <div class="hdr-sub">Project Management &amp; Notification System</div></div>
  <div class="bdy">
    <div class="badge">&#9888; Stage {stage} of 4 &nbsp;&middot;&nbsp; {label}</div>
    <h2>{project.title}</h2>
    <p class="sub">Pillar: {project.pillar or 'N/A'} &nbsp;&middot;&nbsp; Status: {project.status}</p>
    <div class="countdown">
      <div class="countdown-num">~{months_left}</div>
      <div class="countdown-lbl">{months_str} remaining until deadline</div>
    </div>
    <div style="display:flex;gap:6px;margin:16px 0 4px;">{stage_dots}</div>
    <p style="font-size:11px;color:{BRAND_MUTED};margin:2px 0 20px;">Reminder {stage} of 4</p>
    <table class="meta">
      <tr><td>Project Manager</td><td>{manager_name}</td></tr>
      <tr><td>Deadline</td><td><strong style="color:{colour};">{project.end_date}</strong></td></tr>
      <tr><td>Progress</td><td><span style="font-weight:600;">{progress}%</span>
        <div class="prog-bg"><div class="prog-fill"></div></div></td></tr>
    </table>
    <div class="hint"><strong>Action Required:</strong><br>
      Review the project timeline and ensure all milestones are on track.
    </div>
  </div>
  <div class="ftr">
    <p style="margin:0 0 4px;">ProTracker notification for project <strong>{project.title}</strong>.</p>
    <p style="margin:0;">&copy; {year} ALTEL &nbsp;&middot;&nbsp; ProTracker</p>
  </div>
</div></body></html>"""


def _friendly_error(raw_error: str) -> str:
    """Convert raw SMTP exceptions into clear, actionable messages."""
    e = raw_error.lower()
    if '5.7.3' in raw_error or '535' in raw_error or 'authentication unsuccessful' in e:
        return (
            'Authentication failed (Error 535/5.7.3). '
            'Microsoft has disabled Basic SMTP Auth for this Office 365 account. '
            'Use Gmail SMTP (smtp.gmail.com, port 587) with a Gmail App Password for testing.'
        )
    if '5.7.57' in raw_error or 'client not authenticated' in e:
        return (
            'SMTP AUTH is not enabled for this mailbox. '
            'Ask your IT admin to run: Set-CASMailbox <email> -SmtpClientAuthenticationDisabled $false'
        )
    if 'username and password not accepted' in e or '535-5.7.8' in raw_error:
        return (
            'Incorrect username or password. '
            'If using Gmail, you must use an App Password (not your regular password). '
            'Go to myaccount.google.com → Security → App passwords.'
        )
    if 'connection refused' in e or 'timed out' in e or 'network' in e:
        return (
            'Cannot connect to SMTP server. Check that the host and port are correct, '
            'and that your firewall/network allows outgoing connections on port 587.'
        )
    if 'ssl' in e or 'tls' in e:
        return f'SSL/TLS error. Try toggling the "Use TLS" setting. Raw: {raw_error}'
    if '5.7.1' in raw_error or 'relay' in e:
        return 'Relay denied. The From Email address must match your SMTP username for Office 365.'
    return raw_error


def get_email_backend():
    """Get SMTP config from DB (EmailConfig singleton)."""
    from .models import EmailConfig
    return EmailConfig.get_config()


def send_email(to_emails, subject, body_text, body_html=None):
    """Send email using the DB-configured SMTP settings.
    Returns (success: bool, error: str|None).
    Auto-generates branded HTML if body_html is not provided.
    """
    from .models import EmailLog

    config = get_email_backend()
    if not config.is_active:
        logger.info('Email not sent — SMTP is not active')
        return False, 'SMTP is not configured or inactive'

    if not config.smtp_user or not config.smtp_password:
        return False, 'SMTP credentials not set'

    if isinstance(to_emails, str):
        to_emails = [to_emails]

    to_emails = [e for e in to_emails if e and e.strip()]
    if not to_emails:
        return False, 'No recipients'

    # Auto-generate professional HTML if not provided
    if body_html is None:
        body_html = _build_html(subject, body_text)

    results = []
    for recipient in to_emails:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject

        # Display name: "ProTracker Notifications <email>"
        sender_address = config.from_email or config.smtp_user
        display_name = config.display_name or 'ProTracker'
        msg['From'] = formataddr((display_name, sender_address))
        msg['To'] = recipient

        # Optional Reply-To
        if config.reply_to:
            msg['Reply-To'] = config.reply_to

        msg.attach(MIMEText(body_text, 'plain'))
        msg.attach(MIMEText(body_html, 'html'))

        try:
            if config.smtp_use_tls:
                server = smtplib.SMTP(config.smtp_host, config.smtp_port, timeout=30)
                server.ehlo()
                server.starttls()
                server.ehlo()
            else:
                server = smtplib.SMTP_SSL(config.smtp_host, config.smtp_port, timeout=30)
                server.ehlo()

            server.login(config.smtp_user, config.smtp_password)
            server.sendmail(sender_address, [recipient], msg.as_string())
            server.quit()

            EmailLog.objects.create(
                recipient_email=recipient, subject=subject, body=body_text,
                status='SENT', sent_at=timezone.now(),
            )
            results.append((recipient, True, None))
            logger.info(f'Email sent to {recipient}: {subject}')

        except smtplib.SMTPAuthenticationError as e:
            error_msg = _friendly_error(str(e))
            EmailLog.objects.create(
                recipient_email=recipient, subject=subject, body=body_text,
                status='FAILED', error_message=error_msg,
            )
            results.append((recipient, False, error_msg))
            logger.error(f'SMTP auth failed for {recipient}: {e}')

        except Exception as e:
            error_msg = _friendly_error(str(e))
            EmailLog.objects.create(
                recipient_email=recipient, subject=subject, body=body_text,
                status='FAILED', error_message=error_msg,
            )
            results.append((recipient, False, error_msg))
            logger.error(f'Failed to send email to {recipient}: {e}')

    all_ok = all(r[1] for r in results)
    errors = '; '.join(f'{r[2]}' for r in results if not r[1])
    return all_ok, errors or None


def send_test_email(to_email):
    """Send a branded test email to verify SMTP config works."""
    subject = '[ProTracker] Test Email – SMTP Configuration'
    body_text = (
        'Hello,\n\n'
        'This is a test email from ProTracker Notification System.\n\n'
        'If you received this, your SMTP configuration is working correctly.\n\n'
        'ProTracker helps your team track project progress, deadlines, and milestones '
        'with real-time notifications.\n\n'
        'Best regards,\n'
        'ProTracker Notification System\n'
        'ALTEL'
    )
    return send_email(to_email, subject, body_text)


def send_project_reminder_email(to_emails, project, stage: int, months_left: int):
    """Send a rich HTML project expiry reminder email (generic, non-personalised).
    Returns (success: bool, error: str|None).
    """
    months_str = f'{months_left} month{"s" if months_left != 1 else ""}'
    subject = f'[ProTracker] Stage {stage}/4 – "{project.title}" expires in ~{months_str}'
    body_text = (
        f'Project Expiry Reminder – Stage {stage} of 4\n\n'
        f'Project: {project.title}\n'
        f'Pillar: {project.pillar or "N/A"}\n'
        f'Deadline: {project.end_date}\n'
        f'Time remaining: ~{months_str}\n'
        f'Progress: {getattr(project, "progress_percent", 0)}%\n\n'
        f'This is reminder stage {stage} of 4. Please review the project status and ensure '
        f'all milestones are on track.\n\nLog in to ProTracker to view full details.'
    )
    body_html = _build_reminder_html(project, stage, months_left, len(to_emails))
    return send_email(to_emails, subject, body_text, body_html)


def send_project_reminder_email_to_user(user, project, stage: int, months_left: int):
    """Send a personalised, role-based reminder email to a single user.
    Returns (success: bool, error: str|None).
    """
    if not user.email:
        return False, 'User has no email set'

    months_str = f'{months_left} month{"s" if months_left != 1 else ""}'
    role = getattr(user, 'role', 'ADMIN')
    rc = _get_role_content(role, months_str)
    user_name = user.get_full_name() or user.username
    manager_name = (project.manager.get_full_name() or project.manager.username) if project.manager else 'N/A'

    subject = (
        f'[ALTEL ProTracker] Official Notification — Stage {stage}/4 '
        f'| {project.title} | {rc["role_full"]}'
    )
    # Plain-text version (HTML tags stripped from role content)
    import re
    clean_intro = re.sub(r'<[^>]+>', '', rc['intro'])
    clean_focus = re.sub(r'<[^>]+>', '', rc['focus'])
    today_str = timezone.now().strftime('%d %B %Y')
    sep50 = '\u2500' * 50
    sep30 = '\u2500' * 30
    body_text = (
        f'ALTEL ProTracker \u2014 Official Project Expiry Notification\n'
        f'Stage {stage} of 4\n'
        f'Date: {today_str}\n'
        f'{sep50}\n\n'
        f'TO: {user_name}\n'
        f'ROLE: {rc["role_full"]}\n\n'
        f'Dear {user_name},\n\n'
        f'{clean_intro}\n\n'
        f'PROJECT DETAILS\n'
        f'{sep30}\n'
        f'Project          : {project.title}\n'
        f'Pillar           : {project.pillar or "N/A"}\n'
        f'Status           : {project.status}\n'
        f'Contract Deadline: {project.end_date}\n'
        f'Time Remaining   : approximately {months_str}\n'
        f'Progress         : {getattr(project, "progress_percent", 0)}%\n'
        f'Manager          : {manager_name}\n\n'
        f'ACTION REQUIRED \u2014 {rc["role_full"].upper()}\n'
        f'{sep30}\n'
        f'{clean_focus}\n\n'
        f'Next Step: {rc["cta"]}.\n\n'
        f'{sep50}\n'
        f'This is an official automated notification from the ALTEL ProTracker system.\n'
        f'Do not reply to this email. Contact your system administrator for assistance.\n'
        f'\n\u00a9 {timezone.now().year} ALTEL \u2013 ProTracker Notification System. All rights reserved.'
    )
    body_html = _build_reminder_html_for_user(user, project, stage, months_left)
    return send_email([user.email], subject, body_text, body_html)
