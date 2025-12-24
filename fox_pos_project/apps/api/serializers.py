from rest_framework import serializers
from django.contrib.auth.models import User
from apps.products.models import Product
from apps.customers.models import Customer
from apps.suppliers.models import Supplier
from apps.quotations.models import Quotation, QuotationItem
from .models import Shift, Transaction, AppSettings, ActivityLog


class TransactionSerializer(serializers.ModelSerializer):
    """Serializer for Transaction model"""
    id = serializers.CharField(source='transaction_id', read_only=True)
    relatedId = serializers.SerializerMethodField()
    relatedCustomer = serializers.PrimaryKeyRelatedField(
        source='related_customer', 
        queryset=Customer.objects.all(), 
        required=False, 
        allow_null=True
    )
    relatedSupplier = serializers.PrimaryKeyRelatedField(
        source='related_supplier', 
        queryset=Supplier.objects.all(), 
        required=False, 
        allow_null=True
    )
    supplierName = serializers.SerializerMethodField()
    customerName = serializers.SerializerMethodField()
    paymentMethod = serializers.CharField(source='payment_method', max_length=50)
    dueDate = serializers.DateField(source='due_date', required=False, allow_null=True)
    isDirectSale = serializers.BooleanField(source='is_direct_sale', default=False)
    createdBy = serializers.PrimaryKeyRelatedField(source='created_by', read_only=True)
    items = serializers.SerializerMethodField()
    
    class Meta:
        model = Transaction
        fields = [
            'id', 'type', 'date', 'amount', 'paymentMethod', 'description', 
            'category', 'relatedId', 'relatedCustomer', 'relatedSupplier', 
            'supplierName', 'customerName', 'items', 
            'status', 'dueDate', 'isDirectSale', 'shift', 'createdBy'
        ]
        read_only_fields = ['id', 'date', 'createdBy']
    
    def get_relatedId(self, obj):
        """Get related customer or supplier ID"""
        if obj.related_customer:
            return obj.related_customer.customer_id
        if obj.related_supplier:
            return obj.related_supplier.supplier_id
        return None
    
    def get_supplierName(self, obj):
        """Get supplier name if exists"""
        if obj.related_supplier:
            return obj.related_supplier.supplier_name
        return None
    
    def get_customerName(self, obj):
        """Get customer name if exists"""
        if obj.related_customer:
            return obj.related_customer.customer_name
        return None
    
    def get_items(self, obj):
        """Get items with product names - optimized to avoid N+1 queries"""
        if not obj.items or not isinstance(obj.items, list):
            return []
        
        # Collect all product IDs that need lookup
        product_ids_to_fetch = []
        for item in obj.items:
            if isinstance(item, dict) and not item.get('name') and item.get('id'):
                product_ids_to_fetch.append(item.get('id'))
        
        # Batch fetch all products at once (single query instead of N queries)
        products_map = {}
        if product_ids_to_fetch:
            products = Product.objects.filter(product_id__in=product_ids_to_fetch)
            products_map = {p.product_id: p.product_name for p in products}
        
        # Enrich items with product names
        enriched_items = []
        for item in obj.items:
            if not isinstance(item, dict):
                continue
            
            product_id = item.get('id')
            # Get name from item if already enriched, otherwise from batch fetch
            item_name = item.get('name') or products_map.get(product_id, f'منتج #{product_id}')
            
            enriched_item = {
                'id': product_id,
                'name': item_name,
                'cartQuantity': item.get('quantity', item.get('cartQuantity', 0)),
                'costPrice': float(item.get('cost_price', item.get('costPrice', 0))),
                'sellPrice': float(item.get('price', item.get('sellPrice', 0))),
                'discount': float(item.get('discount', 0))
            }
            enriched_items.append(enriched_item)
        
        return enriched_items


class ShiftSerializer(serializers.ModelSerializer):
    """Serializer for Shift model"""
    id = serializers.IntegerField(source='shift_id', read_only=True)
    user_name = serializers.CharField(source='user.username', read_only=True)
    startTime = serializers.DateTimeField(source='start_time', read_only=True)
    endTime = serializers.DateTimeField(source='end_time', read_only=True)
    startCash = serializers.DecimalField(source='start_cash', max_digits=12, decimal_places=2)
    endCash = serializers.DecimalField(source='end_cash', max_digits=12, decimal_places=2, required=False, allow_null=True)
    expectedCash = serializers.DecimalField(source='expected_cash', max_digits=12, decimal_places=2, read_only=True)
    totalSales = serializers.DecimalField(source='total_sales', max_digits=12, decimal_places=2, read_only=True)
    salesByMethod = serializers.JSONField(source='sales_by_method', read_only=True)
    
    class Meta:
        model = Shift
        fields = [
            'id', 'user', 'user_name', 'startTime', 'endTime', 
            'startCash', 'endCash', 'expectedCash', 'totalSales', 
            'salesByMethod', 'status'
        ]
        read_only_fields = ['user', 'user_name', 'startTime', 'endTime', 'expectedCash', 'totalSales', 'salesByMethod', 'status']


class SupplierSerializer(serializers.ModelSerializer):
    """Serializer for Supplier model"""
    id = serializers.IntegerField(source='supplier_id', read_only=True)
    name = serializers.CharField(source='supplier_name', max_length=200)
    balance = serializers.DecimalField(source='current_balance', max_digits=12, decimal_places=2, read_only=True)
    
    class Meta:
        model = Supplier
        fields = ['id', 'name', 'phone', 'balance', 'is_active']
    
    def create(self, validated_data):
        """Create a new supplier"""
        # Generate supplier code
        last_supplier = Supplier.objects.order_by('-supplier_id').first()
        if last_supplier:
            code_num = int(last_supplier.supplier_code.replace('S', '')) + 1
        else:
            code_num = 1
        validated_data['supplier_code'] = f'S{code_num:04d}'
        
        return Supplier.objects.create(**validated_data)


class CustomerSerializer(serializers.ModelSerializer):
    """Serializer for Customer model"""
    id = serializers.IntegerField(source='customer_id', read_only=True)
    name = serializers.CharField(source='customer_name', max_length=200)
    type = serializers.CharField(source='customer_type', max_length=20)
    balance = serializers.DecimalField(source='current_balance', max_digits=12, decimal_places=2, read_only=True)
    creditLimit = serializers.DecimalField(source='credit_limit', max_digits=12, decimal_places=2)
    
    class Meta:
        model = Customer
        fields = ['id', 'name', 'phone', 'type', 'balance', 'creditLimit', 'is_active']
    
    def validate(self, data):
        """Validate customer data"""
        # If type is consumer, credit_limit must be 0
        customer_type = data.get('customer_type', 'consumer')
        credit_limit = data.get('credit_limit', 0)
        
        if customer_type == 'consumer' and credit_limit != 0:
            raise serializers.ValidationError({
                'creditLimit': 'حد الائتمان للمستهلك يجب أن يكون 0'
            })
        
        return data
    
    def create(self, validated_data):
        """Create a new customer"""
        # Generate customer code
        last_customer = Customer.objects.order_by('-customer_id').first()
        if last_customer:
            code_num = int(last_customer.customer_code.replace('C', '')) + 1
        else:
            code_num = 1
        validated_data['customer_code'] = f'C{code_num:04d}'
        
        return Customer.objects.create(**validated_data)


class ProductSerializer(serializers.ModelSerializer):
    """Serializer for Product model"""
    id = serializers.IntegerField(source='product_id', read_only=True)
    sku = serializers.CharField(source='product_code', max_length=100)
    name = serializers.CharField(source='product_name', max_length=300)
    quantity = serializers.DecimalField(source='current_stock', max_digits=10, decimal_places=2)
    costPrice = serializers.DecimalField(source='purchase_price', max_digits=12, decimal_places=2)
    sellPrice = serializers.DecimalField(source='selling_price', max_digits=12, decimal_places=2)
    minStockAlert = serializers.DecimalField(source='min_stock_level', max_digits=10, decimal_places=2)
    image = serializers.CharField(source='product_image', required=False, allow_blank=True, allow_null=True)
    barcode = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    is_low_stock = serializers.SerializerMethodField()
    
    class Meta:
        model = Product
        fields = [
            'id', 'sku', 'barcode', 'name', 'category', 'quantity', 
            'costPrice', 'sellPrice', 'unit', 'minStockAlert', 'image',
            'is_low_stock', 'is_active'
        ]
    
    def get_is_low_stock(self, obj):
        """Check if product is low on stock"""
        return obj.current_stock <= obj.min_stock_level
    
    def validate_sku(self, value):
        """Validate SKU is unique"""
        # Check if this is an update (instance exists) or create
        if self.instance:
            # Update: allow same SKU for same product
            if self.instance.product_code == value:
                return value
            # Check if SKU exists for other products
            if Product.objects.filter(product_code=value).exclude(product_id=self.instance.product_id).exists():
                raise serializers.ValidationError('كود المنتج (SKU) موجود مسبقاً')
        else:
            # Create: check if SKU exists
            if Product.objects.filter(product_code=value).exists():
                raise serializers.ValidationError('كود المنتج (SKU) موجود مسبقاً')
        return value
    
    def create(self, validated_data):
        """Create a new product"""
        # If barcode is empty, set it to None to avoid unique constraint issues
        if 'barcode' in validated_data and not validated_data['barcode']:
            validated_data['barcode'] = None
        # If product_image is empty, set it to None
        if 'product_image' in validated_data and not validated_data['product_image']:
            validated_data['product_image'] = None
        return Product.objects.create(**validated_data)
    
    def update(self, instance, validated_data):
        """Update an existing product"""
        # If barcode is empty, set it to None
        if 'barcode' in validated_data and not validated_data['barcode']:
            validated_data['barcode'] = None
        # If product_image is empty, set it to None
        if 'product_image' in validated_data and not validated_data['product_image']:
            validated_data['product_image'] = None
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance



class QuotationItemSerializer(serializers.ModelSerializer):
    """Serializer for QuotationItem model"""
    id = serializers.IntegerField(source='product.product_id', read_only=True)
    name = serializers.CharField(source='product.product_name', read_only=True)
    price = serializers.DecimalField(source='unit_price', max_digits=12, decimal_places=2)
    
    class Meta:
        model = QuotationItem
        fields = ['id', 'name', 'quantity', 'price', 'total']
        read_only_fields = ['id', 'name']


class QuotationSerializer(serializers.ModelSerializer):
    """Serializer for Quotation model"""
    id = serializers.IntegerField(source='quotation_id', read_only=True)
    date = serializers.DateField(source='quotation_date', read_only=True)
    customer_name = serializers.CharField(source='customer.customer_name', read_only=True)
    totalAmount = serializers.DecimalField(source='total_amount', max_digits=12, decimal_places=2)
    items = QuotationItemSerializer(source='quotationitem_set', many=True, read_only=True)
    
    class Meta:
        model = Quotation
        fields = [
            'id', 'date', 'customer', 'customer_name', 'items', 
            'totalAmount', 'status'
        ]
        read_only_fields = ['id', 'date', 'customer_name', 'items']



class AppSettingsSerializer(serializers.ModelSerializer):
    """Serializer for AppSettings model"""
    companyName = serializers.CharField(source='company_name', max_length=200)
    companyPhone = serializers.CharField(source='company_phone', max_length=20)
    companyAddress = serializers.CharField(source='company_address')
    logoUrl = serializers.URLField(source='logo_url', required=False, allow_null=True, allow_blank=True)
    autoPrint = serializers.BooleanField(source='auto_print')
    nextInvoiceNumber = serializers.IntegerField(source='next_invoice_number')
    openingBalance = serializers.DecimalField(source='opening_balance', max_digits=12, decimal_places=2)
    taxRate = serializers.DecimalField(source='tax_rate', max_digits=5, decimal_places=2)
    currentShiftId = serializers.IntegerField(source='current_shift_id', required=False, allow_null=True)
    preventNegativeStock = serializers.BooleanField(source='prevent_negative_stock')
    invoiceTerms = serializers.CharField(source='invoice_terms', required=False, allow_blank=True)
    
    class Meta:
        model = AppSettings
        fields = [
            'companyName', 'companyPhone', 'companyAddress', 'logoUrl',
            'autoPrint', 'nextInvoiceNumber', 'openingBalance', 'taxRate',
            'currentShiftId', 'preventNegativeStock', 'invoiceTerms'
        ]



class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model"""
    name = serializers.CharField(source='first_name', max_length=200, required=False, allow_blank=True)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'name', 'is_staff']
        read_only_fields = ['id']
    
    def to_representation(self, instance):
        """Custom representation to match frontend expectations"""
        data = super().to_representation(instance)
        # Map is_staff to role
        if instance.is_staff:
            data['role'] = 'admin'
        else:
            data['role'] = 'cashier'
        return data


class UserCreateSerializer(serializers.Serializer):
    """Serializer for creating users"""
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(max_length=128, write_only=True)
    name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=['admin', 'accountant', 'cashier', 'stock_keeper'])
    
    def create(self, validated_data):
        """Create a new user with hashed password"""
        role = validated_data.pop('role')
        name = validated_data.pop('name', '')
        
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            first_name=name,
            is_staff=(role == 'admin')
        )
        
        return user


class ChangePasswordSerializer(serializers.Serializer):
    """Serializer for changing password"""
    old_password = serializers.CharField(max_length=128, write_only=True)
    new_password = serializers.CharField(max_length=128, write_only=True)



class ActivityLogSerializer(serializers.ModelSerializer):
    """Serializer for ActivityLog model"""
    id = serializers.IntegerField(source='log_id', read_only=True)
    userId = serializers.IntegerField(source='user_id', read_only=True)
    userName = serializers.CharField(source='user_name', read_only=True)
    
    class Meta:
        model = ActivityLog
        fields = ['id', 'date', 'userId', 'userName', 'action', 'details']
        read_only_fields = ['id', 'date', 'userId', 'userName']
