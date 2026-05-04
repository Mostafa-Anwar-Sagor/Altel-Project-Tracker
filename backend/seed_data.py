"""
Seed script — wipes all non-admin users and projects, then loads
the real XEL company project portfolio (32 projects, 5 account managers).
"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from datetime import date
from django.contrib.auth import get_user_model
from apps.projects.models import Project, ProjectMember, ProjectCategory, Pillar, Tag
from apps.accounts.models import UserProfile

User = get_user_model()

# ── 1. Clear existing data ────────────────────────────────────────────────────
print("Clearing existing projects and non-admin users …")
Project.objects.all().delete()
User.objects.exclude(is_superuser=True).delete()
ProjectCategory.objects.all().delete()
Pillar.objects.all().delete()
Tag.objects.all().delete()
print("  Done.\n")

admin = User.objects.filter(is_superuser=True).first()

# ── 2. Business Pillar categories ────────────────────────────────────────────
PILLAR_COLORS = {
    'Managed Network Services': '#3B82F6',
    'Cloud':                    '#06B6D4',
    'IoT':                      '#10B981',
    'PLTE':                     '#8B5CF6',
    'Cybersecurity':            '#EF4444',
}
cats = {}
for name, color in PILLAR_COLORS.items():
    cat, _ = ProjectCategory.objects.get_or_create(name=name, defaults={'color': color, 'icon': name.lower().replace(' ', '-')})
    cats[name] = cat
    Pillar.objects.get_or_create(name=name)
print(f"Pillars / categories: {', '.join(cats)}\n")

# ── 3. Account Manager users ─────────────────────────────────────────────────
def make_user(username, first_name, last_name, phone):
    u, created = User.objects.get_or_create(username=username, defaults={
        'first_name':  first_name,
        'last_name':   last_name,
        'phone':       phone,
        'role':        'ACCOUNT_MANAGER',
        'is_approved': True,
        'is_staff':    False,
    })
    if created:
        u.set_password('Altel@2024')
        u.save()
        UserProfile.objects.get_or_create(user=u, defaults={'position': 'Account Manager'})
    return u

kasyfil  = make_user('kasyfil.aziz',      'Kasyfil Aziz',  'Bin Yusoff',        '013-3941412')
izahar   = make_user('izahar.hamidon',    'Izahar',        'Hamidon',           '019-9971077')
syazmimi = make_user('syazmimi.zakaria',  'Syazmimi',      'Binti Zakaria',     '017-5890649')
reza     = make_user('reza.affendi',      'Reza Affendi',  'Bin Mohamad Khir',  '019-2098117')
athira   = make_user('athira.fathin',     'Athira Fathin', 'Binti Mohd Azani',  '012-5191236')
print("Users created:")
for u in [kasyfil, izahar, syazmimi, reza, athira]:
    print(f"  {u.username:<22}  {u.get_full_name()}")

# ── 4. Helper utilities ───────────────────────────────────────────────────────
_MON = {'Jan':1,'Feb':2,'Mar':3,'Apr':4,'May':5,'Jun':6,
        'Jul':7,'Aug':8,'Sep':9,'Oct':10,'Nov':11,'Dec':12}

def d(day, mon, yr):
    """Build a date from integer day, 3-letter month string, 2-digit year."""
    return date(2000 + yr, _MON[mon], day)

TODAY = date.today()

def add_project(no, title, pillar, client, contact_user, tel, description, start, end):
    status    = 'COMPLETED' if end < TODAY else 'ONGOING'
    progress  = 100 if status == 'COMPLETED' else 0
    p, _ = Project.objects.get_or_create(
        title=title,
        defaults=dict(
            description=description,
            pillar=pillar,
            client_name=client,
            project_manager=contact_user.get_full_name(),
            status=status,
            priority='MEDIUM',
            category=cats[pillar],
            owner=contact_user,
            manager=contact_user,
            created_by=admin,
            start_date=start,
            end_date=end,
            progress_percent=progress,
            color_label=PILLAR_COLORS[pillar],
        )
    )
    ProjectMember.objects.get_or_create(project=p, user=contact_user,
                                        defaults={'role_in_project': 'MANAGER'})
    status_tag = '✔ COMPLETED' if status == 'COMPLETED' else '  ONGOING  '
    print(f"  [{no:>2}] {status_tag}  {title[:65]}")
    return p

# ── 5. All 32 Projects (from company XEL spreadsheet) ────────────────────────
print("\nSeeding projects …")

add_project( 1,
    'M2M SIM Connectivity',
    'Managed Network Services', 'Aco Tech Sdn Bhd', kasyfil, '013-3941412',
    'M2M SIM Connectivity services for Aco Tech Sdn Bhd.',
    d(21,'Oct',19), d(31,'Aug',29))

add_project( 2,
    'Replace Bandwidth Management Including Support and Maintenance',
    'Managed Network Services', 'Padiberas Nasional Berhad Headquarters', izahar, '019-9971077',
    'Replace Bandwidth Management Including Support and Maintenance for Padiberas Nasional Berhad Headquarters.',
    d(6,'Jan',24), d(7,'Jan',27))

add_project( 3,
    'Implement Network Technology Refresh Of Switches And Access Point Devices Including Managed Services',
    'Managed Network Services', 'Padiberas Nasional Berhad Headquarters', izahar, '019-9971077',
    'Implement Network Technology Refresh Of Switches And Access Point Devices Including Managed Services for Padiberas Nasional Berhad Headquarters.',
    d(7,'Jun',24), d(6,'Jun',27))

add_project( 4,
    'M2M 4G LTE Services For Operational Area',
    'Managed Network Services', 'Penang Port Sdn Bhd', syazmimi, '017-5890649',
    'M2M 4G LTE Services For Operational Area for Penang Port Sdn Bhd.',
    d(6,'Sep',24), d(5,'Sep',27))

add_project( 5,
    'Bernas Data Center Co-Location Services and Hardware Lease with Managed Services',
    'Cloud', 'Padiberas Nasional Berhad', izahar, '019-9971077',
    'To Provide Bernas Data Center Co-Location Services and Hardware Lease to Use with Managed Services for Padiberas Nasional Berhad.',
    d(20,'Apr',25), d(19,'Apr',28))

add_project( 6,
    'Private Wireless for KNB Port Klang',
    'Managed Network Services', 'Kontena Nasional Berhad', reza, '019-2098117',
    'Private Wireless network services for Kontena Nasional Berhad at KNB Port Klang.',
    d(5,'Feb',24), d(4,'Feb',28))

add_project( 7,
    'High Mast Smart Lighting — Johor Port Berhad',
    'IoT', 'Johor Port Berhad', reza, '019-2098117',
    'High Mast Smart Lighting IoT solution for Johor Port Berhad.',
    d(14,'Oct',25), d(13,'Oct',26))

add_project( 8,
    'CCTV Surveillance Pilot — Padiberas Nasional Berhad (Prai & Palaman)',
    'IoT', 'Padiberas Nasional Berhad (Prai & Palaman)', izahar, '019-9971077',
    'CCTV Surveillance Pilot deployment for Padiberas Nasional Berhad premises at Prai & Palaman.',
    d(7,'Jul',25), d(31,'Aug',28))

add_project( 9,
    'CCTV Surveillance Pilot — Beras Corporation Sdn Bhd (Kudat & Kidurong)',
    'IoT', 'Beras Corporation Sdn Bhd (Kudat & Kidurong)', izahar, '019-9971077',
    'CCTV Surveillance Pilot deployment for Beras Corporation Sdn Bhd at Kudat & Kidurong.',
    d(7,'Jul',25), d(31,'Aug',28))

add_project(10,
    'LTE and VSAT Connectivity M2M — Tradewinds Plantation Berhad',
    'PLTE', 'Tradewinds Plantation Berhad', kasyfil, '013-3941412',
    'LTE and VSAT Connectivity M2M services for Tradewinds Plantation Berhad.',
    d(28,'Mar',25), d(27,'Mar',28))

add_project(11,
    'Implementation of Direct Internet Access (DIA) Services — CSR Batu Tiga Shah Alam',
    'Managed Network Services', 'Central Sugars Refinery Sdn Bhd (Batu Tiga, Shah Alam)', kasyfil, '013-3941412',
    'Implementation of Direct Internet Access (DIA) services for Central Sugars Refinery Sdn Bhd at Batu Tiga, Shah Alam.',
    d(1,'Jun',24), d(3,'May',27))

add_project(12,
    'Managed Security Services And Next Generation Endpoint Protection — Padiberas',
    'Cybersecurity', 'Padiberas Nasional Berhad', izahar, '019-9971077',
    'Managed Security Services And Next Generation Endpoint Protection for Padiberas Nasional Berhad.',
    d(12,'Jul',25), d(11,'Jul',26))

add_project(13,
    'Upgrade DB For Buggy Station — Glenmarie Golf & Country Club',
    'IoT', 'Glenmarie Golf & Country Club', athira, '012-5191236',
    'Upgrade Database For Buggy Station at Glenmarie Golf & Country Club.',
    d(24,'Nov',25), d(16,'Mar',26))

add_project(14,
    'Purchase of Firewall for HQ & Opun — Tradewinds Plantation Berhad',
    'Cybersecurity', 'Tradewinds Plantation Berhad', kasyfil, '013-3941412',
    'Purchase of Firewall for HQ & Opun for Tradewinds Plantation Berhad.',
    d(13,'Oct',25), d(12,'Oct',28))

add_project(15,
    'Security Surveillance and Assessment Consultancy Services — Padiberas Nasional Berhad',
    'IoT', 'Padiberas Nasional Berhad', izahar, '019-9971077',
    'Security Surveillance and Assessment Consultancy Services for Padiberas Nasional Berhad ("Bernas") '
    'Premises covering Headquarters Glenmarie Shah Alam and Warehouses in Malaysia.',
    d(20,'Dec',24), d(31,'Dec',26))

add_project(16,
    'Falcon Endpoint Protection Enterprise Bundle (Yearly) – 65 Units [RENEWAL] — Rebak Island Marina',
    'Cybersecurity', 'Rebak Island Marina Berhad', syazmimi, '017-5890649',
    'Falcon Endpoint Protection Enterprise Bundle (Yearly) – 65 units renewal for Rebak Island Marina Berhad.',
    d(24,'Nov',25), d(23,'Nov',26))

add_project(17,
    'MIS Falcon Crowdstrike 12-Month Subscription – 100 Units [RENEWAL] — THR Hotel Langkawi',
    'Cybersecurity', 'THR Hotel (Langkawi) Sdn Bhd — Pelangi Beach Resort & Spa Langkawi', syazmimi, '017-5890649',
    'MIS Falcon Crowdstrike 12 months Subscription – 100 Units renewal for THR Hotel (Langkawi) Sdn Bhd '
    '(Pelangi Beach Resort & Spa Langkawi).',
    d(25,'Nov',25), d(24,'Nov',26))

add_project(18,
    'Falcon Endpoint Protection Enterprise Bundle (Yearly) – 90 Units — Benua Perdana Sdn Bhd',
    'Cybersecurity', 'Benua Perdana Sdn Bhd (The Danna Langkawi)', syazmimi, '017-5890649',
    'Falcon Endpoint Protection Enterprise Bundle (Yearly) – 90 units for Benua Perdana Sdn Bhd (The Danna Langkawi).',
    d(25,'Nov',25), d(24,'Nov',26))

add_project(19,
    'Upgrading Direct Internet Access (DIA) — Horsedale Development Berhad',
    'Managed Network Services', 'Horsedale Development Berhad (Glenmarie Hotel and Golf Resort Sdn. Bhd.)', athira, '012-5191236',
    'Upgrading Direct Internet Access (DIA) for Horsedale Development Berhad '
    '(Glenmarie Hotel and Golf Resort Sdn. Bhd.).',
    d(1,'Aug',25), d(31,'Jul',26))

add_project(20,
    'Falcon Endpoint Protection Enterprise Flexible Bundle (Yearly) – 40 Units — Glenmarie Golf',
    'Cybersecurity', 'Horsedale Development Berhad (Glenmarie Golf)', athira, '012-5191236',
    'Falcon Endpoint Protection Enterprise Flexible Bundle (Yearly) – 40 units for '
    'Horsedale Development Berhad (Glenmarie Golf).',
    d(5,'Dec',25), d(4,'Dec',26))

add_project(21,
    'Falcon Endpoint Protection Enterprise Bundle — Horsedale Development Berhad (Glenmarie Hotel)',
    'Cybersecurity', 'Horsedale Development Berhad (Glenmarie Hotel)', athira, '012-5191236',
    'Falcon Endpoint Protection Enterprise Bundle for Horsedale Development Berhad (Glenmarie Hotel).',
    d(25,'Nov',25), d(24,'Nov',26))

add_project(22,
    'Falcon Endpoint Protection Enterprise Bundle (Yearly) – 95 Units — Tradewinds Corporation Berhad',
    'Cybersecurity', 'Tradewinds Corporation Berhad (TCB)', kasyfil, '013-3941412',
    'Falcon Endpoint Protection Enterprise Bundle (Yearly) – 95 Units for Tradewinds Corporation Berhad (TCB).',
    d(28,'Feb',25), d(27,'Feb',26))

add_project(23,
    'Cybersecurity Service Provider — Tradewinds Group (M) Sdn. Bhd.',
    'Cybersecurity', 'Tradewinds Group (M) Sdn. Bhd.', kasyfil, '013-3941412',
    'Cybersecurity Service Provider engagement for Tradewinds Group (M) Sdn. Bhd.',
    d(25,'Nov',25), d(30,'Dec',26))

add_project(24,
    'Managed Network Services — Central Sugars Refinery Sdn Bhd (Padang Terap)',
    'Managed Network Services', 'Central Sugars Refinery Sdn Bhd (Padang Terap)', kasyfil, '013-3941412',
    'Managed Network Services for Central Sugars Refinery Sdn Bhd at Padang Terap.',
    d(1,'Jun',25), d(30,'May',26))

add_project(25,
    'Firewall Renewal 2025 — Central Sugars Refinery Sdn Bhd (Batu Tiga, Shah Alam)',
    'Cybersecurity', 'Central Sugars Refinery Sdn Bhd (Batu Tiga, Shah Alam)', kasyfil, '013-3941412',
    'Firewall Renewal 2025 for Central Sugars Refinery Sdn Bhd at Batu Tiga, Shah Alam.',
    d(6,'Jun',25), d(5,'Jun',26))

add_project(26,
    'Sangfor Endpoint Protection Platform (EPP) — Jasmine Food Corporation Sdn Bhd',
    'Cybersecurity', 'Jasmine Food Corporation Sdn Bhd', kasyfil, '013-3941412',
    'Sangfor Endpoint Protection Platform (EPP) deployment for Jasmine Food Corporation Sdn Bhd.',
    d(24,'Nov',25), d(24,'Dec',26))

add_project(27,
    'Wifi Access Point Including Hardware — Liansin Trading Sdn. Bhd.',
    'Managed Network Services', 'Liansin Trading Sdn. Bhd.', kasyfil, '013-3941412',
    'Wifi Access Point supply and installation including hardware for Liansin Trading Sdn. Bhd.',
    d(9,'Jan',26), d(8,'Jan',27))

add_project(28,
    'Sangfor Endpoint Protection Platform (EPP) – 85 Units — Liansin Trading Sdn. Bhd.',
    'Managed Network Services', 'Liansin Trading Sdn. Bhd.', kasyfil, '013-3941412',
    'Sangfor Endpoint Protection Platform (EPP) – 85 Units for Liansin Trading Sdn. Bhd.',
    d(9,'Jan',26), d(8,'Jan',27))

add_project(29,
    'Wifi Network at Ampang Office — Tradewinds Corporation Berhad (TCB)',
    'Managed Network Services', 'Tradewinds Corporation Berhad (TCB)', kasyfil, '013-3941412',
    'Wifi Network installation and management at Ampang Office for Tradewinds Corporation Berhad (TCB).',
    d(12,'Dec',25), d(11,'Dec',26))

add_project(30,
    'Managed Security Service Program (MSSP) Cybersecurity — Tradewinds Plantation Berhad',
    'Cybersecurity', 'Tradewinds Plantation Berhad', kasyfil, '013-3941412',
    'Managed Security Service Program (MSSP) Cybersecurity for Tradewinds Plantation Berhad.',
    d(1,'Nov',25), d(30,'Oct',26))

add_project(31,
    'Implementation of PNMB Security Operations Center (SOC) Services',
    'Cybersecurity', 'Percetakan Nasional Malaysia Berhad (PNMB)', athira, '012-5191236',
    'Implementation of PNMB Security Operations Center (SOC) Services for '
    'Percetakan Nasional Malaysia Berhad (PNMB).',
    d(15,'Dec',25), d(28,'Feb',26))

add_project(32,
    'Cloud Computing Infrastructure and Associated Service — Tradewinds Plantation Berhad',
    'Cloud', 'Tradewinds Plantation Berhad', kasyfil, '013-3941412',
    'Service Provide for Cloud Computing Infrastructure and Associated Service for Tradewinds Plantation Berhad.',
    d(13,'Feb',26), d(12,'Feb',28))

# ── 6. Summary ────────────────────────────────────────────────────────────────
total     = Project.objects.count()
completed = Project.objects.filter(status='COMPLETED').count()
ongoing   = Project.objects.filter(status='ONGOING').count()

print(f"\n{'='*55}")
print(f"  Seed complete — {total} projects loaded")
print(f"  ONGOING: {ongoing}   COMPLETED: {completed}")
print(f"{'='*55}")
print("\nUser login credentials (all approved):")
print(f"  {'Username':<24} {'Full Name':<35} Password")
print(f"  {'-'*24} {'-'*35} {'--------'}")
for u in [kasyfil, izahar, syazmimi, reza, athira]:
    print(f"  {u.username:<24} {u.get_full_name():<35} Altel@2024")
print(f"\n  Admin superuser password unchanged.")
