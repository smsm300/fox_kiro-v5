import os
import sys
import django
from django.db import connection

# Add project root to Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fox_pos.settings')
django.setup()

def drop_view():
    with connection.cursor() as cursor:
        try:
            cursor.execute("DROP VIEW IF EXISTS fox_system.v_inventory_summary;")
            print("Successfully dropped view fox_system.v_inventory_summary")
        except Exception as e:
            print(f"Error dropping view: {e}")

if __name__ == "__main__":
    drop_view()
