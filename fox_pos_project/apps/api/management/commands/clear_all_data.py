from django.core.management.base import BaseCommand
from apps.api.models import Transaction, Shift, ActivityLog
from apps.quotations.models import Quotation
from apps.customers.models import Customer
from apps.suppliers.models import Supplier
from apps.products.models import Product


class Command(BaseCommand):
    help = 'مسح جميع البيانات من قاعدة البيانات'

    def handle(self, *args, **options):
        self.stdout.write('جاري مسح البيانات...')
        
        # Delete all data (order matters due to foreign keys)
        Transaction.objects.all().delete()
        self.stdout.write(self.style.SUCCESS('✓ تم مسح المعاملات'))
        
        Quotation.objects.all().delete()
        self.stdout.write(self.style.SUCCESS('✓ تم مسح عروض الأسعار'))
        
        Shift.objects.all().delete()
        self.stdout.write(self.style.SUCCESS('✓ تم مسح الورديات'))
        
        ActivityLog.objects.all().delete()
        self.stdout.write(self.style.SUCCESS('✓ تم مسح سجل الأنشطة'))
        
        Product.objects.all().delete()
        self.stdout.write(self.style.SUCCESS('✓ تم مسح المنتجات'))
        
        Customer.objects.all().delete()
        self.stdout.write(self.style.SUCCESS('✓ تم مسح العملاء'))
        
        Supplier.objects.all().delete()
        self.stdout.write(self.style.SUCCESS('✓ تم مسح الموردين'))
        
        self.stdout.write(self.style.SUCCESS('\n[OK] تم مسح جميع البيانات بنجاح!'))
