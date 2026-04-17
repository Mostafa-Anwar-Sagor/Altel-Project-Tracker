from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.projects.models import Project, Pillar, Milestone, ProjectMember
from apps.tasks.models import Task
from apps.comments.models import ActivityLog
from datetime import date

User = get_user_model()

PROJECTS = [
    {
        "pillar": "Managed Network Services",
        "client_name": "Aco Tech Sdn Bhd",
        "contact_person": "Kasyfil Aziz Bin Yusoff",
        "contact_tel": "013-3941412",
        "title": "M2M SIM Connectivity",
        "description": "M2M SIM Connectivity",
        "start_date": date(2019, 10, 21),
        "end_date": date(2029, 8, 31),
    },
    {
        "pillar": "Managed Network Services",
        "client_name": "Padiberas Nasional Berhad Headquarters",
        "contact_person": "Izahar Hamidon",
        "contact_tel": "019-9971077",
        "title": "Replace Bandwidth Management Including Support and Maintenance",
        "description": "Replace Bandwidth Management Including Support and Maintenance",
        "start_date": date(2024, 1, 6),
        "end_date": date(2027, 1, 7),
    },
    {
        "pillar": "Managed Network Services",
        "client_name": "Padiberas Nasional Berhad Headquarters",
        "contact_person": "Izahar Hamidon",
        "contact_tel": "019-9971077",
        "title": "Implement Network Technology Refresh Of Switches And Access Point Devices Including Managed Services",
        "description": "Implement Network Technology Refresh Of Switches And Access Point Devices Including Managed Services",
        "start_date": date(2024, 6, 7),
        "end_date": date(2027, 6, 6),
    },
    {
        "pillar": "Managed Network Services",
        "client_name": "Penang Port Sdn Bhd",
        "contact_person": "Syazmimi Binti Zakaria",
        "contact_tel": "017-5890649",
        "title": "M2M 4G LTE Services For Operational Area",
        "description": "M2M 4G LTE Services For Operational Area",
        "start_date": date(2024, 9, 6),
        "end_date": date(2027, 9, 5),
    },
    {
        "pillar": "Cloud",
        "client_name": "Padiberas Nasional Berhad",
        "contact_person": "Izahar Hamidon",
        "contact_tel": "019-9971077",
        "title": "To Provide Bernas Data Center Co-Location Services and Hardware Lease to Use with Manage Services",
        "description": "To Provide Bernas Data Center Co-Location Services and Hardware Lease to Use with Manage Services",
        "start_date": date(2025, 4, 20),
        "end_date": date(2028, 4, 19),
    },
    {
        "pillar": "Managed Network Services",
        "client_name": "Kontena Nasional Berhad",
        "contact_person": "Reza Affendi Bin Mohamad Khir",
        "contact_tel": "019-2098117",
        "title": "Private Wireless for KNB Port Klang",
        "description": "Private Wireless for KNB Port Klang",
        "start_date": date(2024, 2, 5),
        "end_date": date(2028, 2, 4),
    },
    {
        "pillar": "IoT",
        "client_name": "Johor Port Berhad",
        "contact_person": "Reza Affendi Bin Mohamad Khir",
        "contact_tel": "019-2098117",
        "title": "High Mast Smart Lighting",
        "description": "High Mast Smart Lighting",
        "start_date": date(2025, 10, 14),
        "end_date": date(2026, 10, 13),
    },
    {
        "pillar": "IoT",
        "client_name": "Padiberas Nasional Berhad (Prai & Palaman)",
        "contact_person": "Izahar Hamidon",
        "contact_tel": "019-9971077",
        "title": "CCTV Surveillance Pilot (Prai & Palaman)",
        "description": "CCTV Surveillance Pilot",
        "start_date": date(2025, 7, 7),
        "end_date": date(2028, 8, 31),
    },
    {
        "pillar": "IoT",
        "client_name": "Beras Corporation Sdn Bhd (Kudat & Kidurong)",
        "contact_person": "Izahar Hamidon",
        "contact_tel": "019-9971077",
        "title": "CCTV Surveillance Pilot (Kudat & Kidurong)",
        "description": "CCTV Surveillance Pilot",
        "start_date": date(2025, 7, 7),
        "end_date": date(2028, 8, 31),
    },
    {
        "pillar": "PLTE",
        "client_name": "Tradewinds Plantation Berhad",
        "contact_person": "Kasyfil Aziz Bin Yusoff",
        "contact_tel": "013-3941412",
        "title": "LTE and VSAT Connectivity M2M",
        "description": "LTE and VSAT Connectivity M2M",
        "start_date": date(2025, 3, 28),
        "end_date": date(2028, 3, 27),
    },
    {
        "pillar": "Managed Network Services",
        "client_name": "Central Sugars Refinery Sdn Bhd (Batu Tiga, Shah Alam)",
        "contact_person": "Kasyfil Aziz Bin Yusoff",
        "contact_tel": "013-3941412",
        "title": "Implementation of Direct Internet Access (DIA) services",
        "description": "Implementation of Direct Internet Access (DIA) services",
        "start_date": date(2024, 6, 1),
        "end_date": date(2027, 5, 3),
    },
    {
        "pillar": "Cybersecurity",
        "client_name": "Padiberas Nasional Berhad",
        "contact_person": "Izahar Hamidon",
        "contact_tel": "019-9971077",
        "title": "Managed Security Services And Next Generation Endpoint Protection",
        "description": "Managed Security Services And Next Generation Endpoint Protection",
        "start_date": date(2025, 7, 12),
        "end_date": date(2026, 7, 11),
    },
    {
        "pillar": "IoT",
        "client_name": "Glenmarie Golf & Country Club",
        "contact_person": "Athira Fathin Binti Mohd Azani",
        "contact_tel": "012-5191236",
        "title": "Upgrade DB For Buggy Station",
        "description": "Upgrade DB For Buggy Station",
        "start_date": date(2025, 11, 24),
        "end_date": date(2026, 3, 16),
    },
    {
        "pillar": "Cybersecurity",
        "client_name": "Tradewinds Plantation Berhad",
        "contact_person": "Kasyfil Aziz Bin Yusoff",
        "contact_tel": "013-3941412",
        "title": "Purchase of Firewall for HQ & Opun",
        "description": "Purchase of Firewall for HQ & Opun",
        "start_date": date(2025, 10, 13),
        "end_date": date(2028, 10, 12),
    },
    {
        "pillar": "IoT",
        "client_name": "Padiberas Nasional Berhad",
        "contact_person": "Izahar Hamidon",
        "contact_tel": "019-9971077",
        "title": "Security Surveillance and Assessment Consultancy Services for Padiberas Nasional Berhad (Bernas) Premises",
        "description": "Security Surveillance and Assessment Consultancy Services for Padiberas Nasional Berhad (Bernas) Premises Covering Headquarters Glenmarie Shah Alam and Warehouses in Malaysia",
        "start_date": date(2024, 12, 20),
        "end_date": date(2026, 12, 31),
    },
    {
        "pillar": "Cybersecurity",
        "client_name": "Rebak Island Marina Berhad",
        "contact_person": "Syazmimi Binti Zakaria",
        "contact_tel": "017-5890649",
        "title": "Falcon Endpoint Protection Enterprise Bundle (Yearly) - 65 units [RENEWAL]",
        "description": "Falcon Endpoint Protection Enterprise Bundle (Yearly) - 65 units [RENEWAL]",
        "start_date": date(2025, 11, 24),
        "end_date": date(2026, 11, 23),
    },
    {
        "pillar": "Cybersecurity",
        "client_name": "THR Hotel (Langkawi) Sdn Bhd (Pelangi Beach Resort & Spa Langkawi)",
        "contact_person": "Syazmimi Binti Zakaria",
        "contact_tel": "017-5890649",
        "title": "MIS Falcon Crowdstrike 12 months Subscription - 100 Units [RENEWAL]",
        "description": "MIS Falcon Crowdstrike 12 months Subscription - 100 Units [RENEWAL]",
        "start_date": date(2025, 11, 25),
        "end_date": date(2026, 11, 24),
    },
    {
        "pillar": "Cybersecurity",
        "client_name": "Benua Perdana Sdn Bhd (The Danna Langkawi)",
        "contact_person": "Syazmimi Binti Zakaria",
        "contact_tel": "017-5890649",
        "title": "Falcon Endpoint Protection Enterprise Bundle (Yearly) - 90 units",
        "description": "Falcon Endpoint Protection Enterprise Bundle (Yearly) - 90 units",
        "start_date": date(2025, 11, 25),
        "end_date": date(2026, 11, 24),
    },
    {
        "pillar": "Managed Network Services",
        "client_name": "Horsedale Development Berhad (Glenmarie Hotel and Golf Resort Sdn Bhd.)",
        "contact_person": "Athira Fathin Binti Mohd Azani",
        "contact_tel": "012-5191236",
        "title": "Upgrading Direct Internet Access (DIA)",
        "description": "Upgrading Direct Internet Access (DIA)",
        "start_date": date(2025, 8, 1),
        "end_date": date(2028, 7, 31),
    },
    {
        "pillar": "Cybersecurity",
        "client_name": "Horsedale Development Berhad (Glenmarie Golf)",
        "contact_person": "Athira Fathin Binti Mohd Azani",
        "contact_tel": "012-5191236",
        "title": "Falcon Endpoint Protection Enterprise Flexible Bundle (Yearly) - 40 units",
        "description": "Falcon Endpoint Protection Enterprise Flexible Bundle (Yearly) - 40 units",
        "start_date": date(2025, 12, 5),
        "end_date": date(2026, 12, 4),
    },
    {
        "pillar": "Cybersecurity",
        "client_name": "Horsedale Development Berhad (Glenmarie Hotel)",
        "contact_person": "Athira Fathin Binti Mohd Azani",
        "contact_tel": "012-5191236",
        "title": "Falcon Endpoint Protection Enterprise Bundle",
        "description": "Falcon Endpoint Protection Enterprise Bundle",
        "start_date": date(2025, 11, 25),
        "end_date": date(2026, 11, 24),
    },
    {
        "pillar": "Cybersecurity",
        "client_name": "Tradewinds Corporation Berhad (TCB)",
        "contact_person": "Kasyfil Aziz Bin Yusoff",
        "contact_tel": "013-3941412",
        "title": "Falcon Endpoint Protection Enterprise Bundle (Yearly) - 95 Units",
        "description": "Falcon Endpoint Protection Enterprise Bundle (Yearly) - 95 Units",
        "start_date": date(2025, 2, 28),
        "end_date": date(2026, 2, 27),
    },
    {
        "pillar": "Cybersecurity",
        "client_name": "Tradewinds Group (M) Sdn Bhd.",
        "contact_person": "Kasyfil Aziz Bin Yusoff",
        "contact_tel": "013-3941412",
        "title": "Cybersecurity Service Provider",
        "description": "Cybersecurity Service Provider",
        "start_date": date(2025, 11, 25),
        "end_date": date(2026, 12, 30),
    },
    {
        "pillar": "Managed Network Services",
        "client_name": "Central Sugars Refinery Sdn Bhd (Padang Terap)",
        "contact_person": "Kasyfil Aziz Bin Yusoff",
        "contact_tel": "013-3941412",
        "title": "Managed Network Services",
        "description": "Managed Network Services",
        "start_date": date(2025, 6, 1),
        "end_date": date(2026, 5, 30),
    },
    {
        "pillar": "Cybersecurity",
        "client_name": "Central Sugars Refinery Sdn Bhd (Batu Tiga, Shah Alam)",
        "contact_person": "Kasyfil Aziz Bin Yusoff",
        "contact_tel": "013-3941412",
        "title": "Firewall Renewal 2025",
        "description": "Firewall Renewal 2025",
        "start_date": date(2025, 6, 6),
        "end_date": date(2026, 6, 5),
    },
    {
        "pillar": "Cybersecurity",
        "client_name": "Jasmine Food Corporation Sdn Bhd",
        "contact_person": "Kasyfil Aziz Bin Yusoff",
        "contact_tel": "013-3941412",
        "title": "Sangfor Endpoint Protection Platform (EPP)",
        "description": "Sangfor Endpoint Protection Platform (EPP)",
        "start_date": date(2025, 11, 24),
        "end_date": date(2026, 12, 24),
    },
    {
        "pillar": "Managed Network Services",
        "client_name": "Liansin Trading Sdn. Bhd.",
        "contact_person": "Kasyfil Aziz Bin Yusoff",
        "contact_tel": "013-3941412",
        "title": "Wifi Access Point (Including Hardware)",
        "description": "Wifi Access Point (Including Hardware)",
        "start_date": date(2026, 1, 9),
        "end_date": date(2027, 1, 8),
    },
    {
        "pillar": "Managed Network Services",
        "client_name": "Liansin Trading Sdn. Bhd.",
        "contact_person": "Kasyfil Aziz Bin Yusoff",
        "contact_tel": "013-3941412",
        "title": "Sangfor Endpoint Protection Platform (EPP) - 85 Units",
        "description": "Sangfor Endpoint Protection Platform (EPP) - 85 Units",
        "start_date": date(2025, 12, 12),
        "end_date": date(2027, 1, 8),
    },
    {
        "pillar": "Managed Network Services",
        "client_name": "Tradewinds Corporation Berhad (TCB)",
        "contact_person": "Kasyfil Aziz Bin Yusoff",
        "contact_tel": "013-3941412",
        "title": "Wifi Network at Ampang Office",
        "description": "Wifi Network at Ampang Office",
        "start_date": date(2025, 12, 12),
        "end_date": date(2026, 12, 11),
    },
    {
        "pillar": "Cybersecurity",
        "client_name": "Tradewinds Plantation Berhad",
        "contact_person": "Kasyfil Aziz Bin Yusoff",
        "contact_tel": "013-3941412",
        "title": "Managed Security Service Program (MSSP) Cybersecurity",
        "description": "Managed Security Service Program (MSSP) Cybersecurity",
        "start_date": date(2025, 11, 1),
        "end_date": date(2028, 10, 30),
    },
    {
        "pillar": "Cybersecurity",
        "client_name": "Percetakan Nasional Malaysia Berhad (PNMB)",
        "contact_person": "Athira Fathin Binti Mohd Azani",
        "contact_tel": "012-5191236",
        "title": "Implementation of PNMB Security Operations Center (SOC) Services",
        "description": "Implementation of PNMB Security Operations Center (SOC) Services",
        "start_date": date(2025, 12, 15),
        "end_date": date(2028, 2, 28),
    },
    {
        "pillar": "Cloud",
        "client_name": "Tradewinds Plantation Berhad",
        "contact_person": "Kasyfil Aziz Bin Yusoff",
        "contact_tel": "013-3941412",
        "title": "Cloud Computing Infrastructure and Associated Service",
        "description": "Service Provide for Cloud Computing Infrastructure and Associated Service",
        "start_date": date(2026, 2, 13),
        "end_date": date(2028, 2, 12),
    },
]


class Command(BaseCommand):
    help = 'Delete all demo data and seed 32 real projects from spreadsheet'

    def handle(self, *args, **options):
        owner = User.objects.filter(is_superuser=True).first()
        if not owner:
            self.stderr.write(self.style.ERROR('No superuser found. Create one first.'))
            return

        # Delete all existing project data
        self.stdout.write('Deleting all existing projects, tasks, milestones, activities...')
        ActivityLog.objects.all().delete()
        Task.objects.all().delete()
        Milestone.objects.all().delete()
        ProjectMember.objects.all().delete()
        Project.objects.all().delete()
        Pillar.objects.all().delete()
        self.stdout.write(self.style.SUCCESS('All demo data deleted.'))

        # Create pillars
        pillar_names = ['Managed Network Services', 'Cybersecurity', 'IoT', 'Cloud', 'PLTE']
        for name in pillar_names:
            Pillar.objects.create(name=name)
        self.stdout.write(self.style.SUCCESS(f'Created {len(pillar_names)} pillars.'))

        # Create projects
        today = date.today()
        created = 0
        for p in PROJECTS:
            # Determine status based on dates
            start = p['start_date']
            end = p['end_date']
            if end < today:
                status = 'COMPLETED'
                progress = 100
            elif start > today:
                status = 'DRAFT'
                progress = 0
            else:
                status = 'ONGOING'
                # Calculate approximate progress
                total_days = (end - start).days or 1
                elapsed = (today - start).days
                progress = min(95, max(5, int((elapsed / total_days) * 100)))

            project = Project.objects.create(
                title=p['title'],
                description=p['description'],
                pillar=p['pillar'],
                client_name=p['client_name'],
                contact_person=p['contact_person'],
                contact_tel=p['contact_tel'],
                start_date=start,
                end_date=end,
                status=status,
                priority='MEDIUM',
                progress_percent=progress,
                owner=owner,
                created_by=owner,
            )
            ProjectMember.objects.create(project=project, user=owner, role_in_project='MANAGER')
            created += 1

        self.stdout.write(self.style.SUCCESS(f'Successfully seeded {created} projects.'))
