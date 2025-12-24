from django.db import models

class Product(models.Model):
    product_id = models.AutoField(primary_key=True)
    product_code = models.CharField(max_length=100, unique=True)
    barcode = models.CharField(max_length=100, unique=True, blank=True, null=True)
    product_name = models.CharField(max_length=300)
    product_name_ar = models.CharField(max_length=300, blank=True, null=True)
    category = models.CharField(max_length=100, blank=True, null=True)
    unit = models.CharField(max_length=50, default='قطعة')
    purchase_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    selling_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    min_stock_level = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    max_stock_level = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    current_stock = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    product_image = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    allow_decimal = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    description = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'fox_system"."products'
        managed = True
        verbose_name = 'منتج'
        verbose_name_plural = 'المنتجات'

    def __str__(self):
        return f"{self.product_code} - {self.product_name}"
