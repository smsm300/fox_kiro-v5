import os
import sys
import django
import json
from django.core import serializers

# Add project root to Python path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(project_root)

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fox_pos.settings')
django.setup()

from django.core.management import call_command

def backup():
    output_file = "../fox_db_backup.json"
    with open(output_file, "w", encoding="utf-8") as f:
        call_command('dumpdata', indent=2, stdout=f)
    print(f"Backup created: {output_file}")

if __name__ == "__main__":
    backup()
