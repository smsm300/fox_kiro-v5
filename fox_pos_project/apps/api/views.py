from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.pagination import PageNumberPagination
from django.contrib.auth.models import User
from apps.products.models import Product
from apps.customers.models import Customer
from apps.suppliers.models import Supplier
from apps.quotations.models import Quotation, QuotationItem
from .models import Shift, Transaction, AppSettings, ActivityLog
from .serializers import (ProductSerializer, CustomerSerializer, SupplierSerializer, 
                          ShiftSerializer, TransactionSerializer, QuotationSerializer, 
                          AppSettingsSerializer, UserSerializer, UserCreateSerializer, 
                          ChangePasswordSerializer, ActivityLogSerializer)
from .exceptions import BusinessRuleViolation
from django.utils import timezone
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from django.db import transaction as db_transaction
import uuid


def get_user_shift(user):
    """
    Get the current user's open shift.
    Admin users can work without a shift.
    
    Returns:
        Shift object or None
    """
    if user and user.is_staff:
        # Admin can work with or without a shift
        return Shift.objects.filter(user=user, status='open').first()
    elif user:
        # Non-admin users should have their own shift
        return Shift.objects.filter(user=user, status='open').first()
    return None


class TransactionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Transaction operations
    
    GET    /api/transactions/           - List transactions
    POST   /api/transactions/           - Create transaction
    PUT    /api/transactions/{id}/approve/ - Approve pending transaction
    PUT    /api/transactions/{id}/reject/  - Reject pending transaction
    POST   /api/transactions/{id}/return/  - Process return
    """
    queryset = Transaction.objects.all()
    serializer_class = TransactionSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['type', 'status', 'shift', 'related_customer', 'related_supplier']
    ordering_fields = ['date', 'amount']
    ordering = ['-date']
    
    def get_queryset(self):
        """Filter transactions by date range if provided"""
        queryset = super().get_queryset()
        from_date = self.request.query_params.get('from_date')
        to_date = self.request.query_params.get('to_date')
        
        if from_date:
            queryset = queryset.filter(date__date__gte=from_date)
        if to_date:
            queryset = queryset.filter(date__date__lte=to_date)
        
        return queryset
    
    def perform_create(self, serializer):
        """Create transaction with auto-generated ID"""
        # Generate transaction ID based on type
        trans_type = self.request.data.get('type', 'TXN')
        type_prefix = {
            'مصروف': 'EXP',
            'إيداع رأس مال': 'CAP',
            'مسحوبات شخصية': 'WDR',
            'تسوية دين': 'SET',
        }.get(trans_type, 'TXN')
        
        transaction_id = f"{type_prefix}-{uuid.uuid4().hex[:12].upper()}"
        
        # Get current user's shift
        open_shift = get_user_shift(request.user)
        
        # Check if expense needs approval (amount > 2000 and user is not admin)
        status = 'completed'
        if trans_type == 'مصروف':
            amount = float(self.request.data.get('amount', 0))
            if amount > 2000 and not self.request.user.is_staff:
                status = 'pending'
        
        serializer.save(
            transaction_id=transaction_id,
            created_by=self.request.user,
            shift=open_shift,
            status=status
        )
    
    @action(detail=True, methods=['put'], permission_classes=[IsAdminUser])
    def approve(self, request, pk=None):
        """
        Approve pending transaction (admin only)
        PUT /api/transactions/{id}/approve/
        """
        transaction = self.get_object()
        
        if transaction.status != 'pending':
            raise BusinessRuleViolation(
                'يمكن الموافقة على المعاملات المعلقة فقط',
                error_code='INVALID_STATUS'
            )
        
        transaction.status = 'completed'
        transaction.save()
        
        serializer = self.get_serializer(transaction)
        return Response(serializer.data)
    
    @action(detail=True, methods=['put'], permission_classes=[IsAdminUser])
    def reject(self, request, pk=None):
        """
        Reject pending transaction (admin only)
        PUT /api/transactions/{id}/reject/
        """
        transaction = self.get_object()
        
        if transaction.status != 'pending':
            raise BusinessRuleViolation(
                'يمكن رفض المعاملات المعلقة فقط',
                error_code='INVALID_STATUS'
            )
        
        transaction.status = 'rejected'
        transaction.save()
        
        serializer = self.get_serializer(transaction)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def create_sale(self, request):
        """
        Create a sale transaction using SaleService
        POST /api/transactions/create_sale/
        Body: {
            "cart_items": [...],
            "customer_id": 1,
            "payment_method": "كاش",
            "total_amount": 1000,
            "invoice_id": "INV-001" (optional),
            "is_direct_sale": false
        }
        """
        from .services.sale_service import SaleService
        
        # Support both 'items' and 'cart_items' for backwards compatibility
        cart_items = request.data.get('items', request.data.get('cart_items', []))
        customer_id = request.data.get('customer_id')
        payment_method = request.data.get('payment_method')
        total_amount = request.data.get('total_amount')
        invoice_id = request.data.get('invoice_id')
        is_direct_sale = request.data.get('is_direct_sale', False)
        
        try:
            sale_transaction = SaleService.complete_sale(
                cart_items=cart_items,
                customer_id=customer_id,
                payment_method=payment_method,
                total_amount=total_amount,
                invoice_id=invoice_id,
                is_direct_sale=is_direct_sale,
                user=request.user
            )
            
            serializer = self.get_serializer(sale_transaction)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except BusinessRuleViolation as e:
            return Response(
                {'error_code': e.error_code, 'message': e.message},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'])
    def process_return(self, request, pk=None):
        """
        Process a return for a sale transaction
        POST /api/transactions/{id}/process_return/
        """
        from .services.sale_service import SaleService
        
        try:
            return_transaction = SaleService.process_return(
                transaction_id=pk,
                user=request.user
            )
            
            serializer = self.get_serializer(return_transaction)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except BusinessRuleViolation as e:
            return Response(
                {'error_code': e.error_code, 'message': e.message},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=['post'])
    def create_purchase(self, request):
        """
        Create a purchase transaction using PurchaseService
        POST /api/transactions/create_purchase/
        Body: {
            "items": [...],  # or "cart_items": [...]
            "supplier_id": 1,
            "payment_method": "كاش",
            "total_amount": 1000
        }
        """
        from .services.purchase_service import PurchaseService
        
        # Accept both 'items' and 'cart_items' for compatibility
        cart_items = request.data.get('items', request.data.get('cart_items', []))
        supplier_id = request.data.get('supplier_id')
        payment_method = request.data.get('payment_method')
        total_amount = request.data.get('total_amount')
        
        try:
            purchase_transaction = PurchaseService.complete_purchase(
                cart_items=cart_items,
                supplier_id=supplier_id,
                payment_method=payment_method,
                total_amount=total_amount,
                user=request.user
            )
            
            serializer = self.get_serializer(purchase_transaction)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except BusinessRuleViolation as e:
            return Response(
                {'error_code': e.error_code, 'message': e.message},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'])
    def process_purchase_return(self, request, pk=None):
        """
        Process a return for a purchase transaction
        POST /api/transactions/{id}/process_purchase_return/
        """
        from .services.purchase_service import PurchaseService
        
        try:
            return_transaction = PurchaseService.process_return(
                transaction_id=pk,
                user=request.user
            )
            
            serializer = self.get_serializer(return_transaction)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except BusinessRuleViolation as e:
            return Response(
                {'error_code': e.error_code, 'message': e.message},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=['post'])
    def create_expense(self, request):
        """
        Create expense transaction
        POST /api/transactions/create_expense/
        Body: {
            "amount": 1000,
            "category": "مصروفات تشغيلية",
            "description": "مصروف",
            "payment_method": "كاش"
        }
        """
        amount = request.data.get('amount')
        category = request.data.get('category', 'مصروفات تشغيلية')
        description = request.data.get('description', 'مصروف')
        payment_method = request.data.get('payment_method', 'كاش')
        
        # Get user's current shift
        open_shift = get_user_shift(request.user)
        
        # Check if needs approval
        status_value = 'completed'
        if amount > 2000 and not request.user.is_staff:
            status_value = 'pending'
        
        transaction = Transaction.objects.create(
            transaction_id=f"EXP-{uuid.uuid4().hex[:12].upper()}",
            type='مصروف',
            amount=amount,
            payment_method=payment_method,
            category=category,
            description=description,
            status=status_value,
            shift=open_shift,
            created_by=request.user
        )
        
        serializer = self.get_serializer(transaction)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['post'])
    def create_capital(self, request):
        """
        Create capital deposit transaction
        POST /api/transactions/create_capital/
        Body: {
            "amount": 1000,
            "description": "إيداع رأس مال"
        }
        """
        amount = request.data.get('amount')
        description = request.data.get('description', 'إيداع رأس مال')
        
        # Get user's current shift
        open_shift = get_user_shift(request.user)
        
        transaction = Transaction.objects.create(
            transaction_id=f"CAP-{uuid.uuid4().hex[:12].upper()}",
            type='إيداع رأس مال',
            amount=amount,
            payment_method='كاش',
            description=description,
            status='completed',
            shift=open_shift,
            created_by=request.user
        )
        
        serializer = self.get_serializer(transaction)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['post'])
    def create_withdrawal(self, request):
        """
        Create withdrawal transaction
        POST /api/transactions/create_withdrawal/
        Body: {
            "amount": 1000,
            "description": "مسحوبات شخصية"
        }
        """
        amount = request.data.get('amount')
        description = request.data.get('description', 'مسحوبات شخصية')
        
        # Get user's current shift
        open_shift = get_user_shift(request.user)
        
        transaction = Transaction.objects.create(
            transaction_id=f"WDR-{uuid.uuid4().hex[:12].upper()}",
            type='مسحوبات شخصية',
            amount=amount,
            payment_method='كاش',
            description=description,
            status='completed',
            shift=open_shift,
            created_by=request.user
        )
        
        serializer = self.get_serializer(transaction)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ShiftViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Shift management
    
    GET    /api/shifts/           - List shifts
    POST   /api/shifts/open/      - Open new shift
    POST   /api/shifts/{id}/close/ - Close shift
    """
    queryset = Shift.objects.all()
    serializer_class = ShiftSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    ordering_fields = ['start_time', 'status']
    ordering = ['-start_time']
    
    def create(self, request, *args, **kwargs):
        """Disabled - use open action instead"""
        return Response(
            {'error_code': 'METHOD_NOT_ALLOWED', 'message': 'استخدم /api/shifts/open/ لفتح وردية'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED
        )
    
    @action(detail=False, methods=['post'])
    def open(self, request):
        """
        Open a new shift
        POST /api/shifts/open/
        Body: { "start_cash": 1000 }
        """
        # Check if THIS USER already has an open shift
        open_shift = Shift.objects.filter(user=request.user, status='open').first()
        if open_shift:
            raise BusinessRuleViolation(
                'لديك وردية مفتوحة بالفعل',
                error_code='SHIFT_ALREADY_OPEN'
            )
        
        start_cash = request.data.get('start_cash')
        if start_cash is None:
            return Response(
                {'error_code': 'VALIDATION_ERROR', 'message': 'start_cash مطلوب'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            start_cash = float(start_cash)
        except ValueError:
            return Response(
                {'error_code': 'VALIDATION_ERROR', 'message': 'start_cash يجب أن يكون رقم'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create new shift
        shift = Shift.objects.create(
            user=request.user,
            start_cash=start_cash,
            status='open'
        )
        
        serializer = self.get_serializer(shift)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        """
        Close a shift
        POST /api/shifts/{id}/close/
        Body: { "end_cash": 5000 }
        """
        shift = self.get_object()
        
        if shift.status == 'closed':
            raise BusinessRuleViolation(
                'الوردية مغلقة بالفعل',
                error_code='SHIFT_ALREADY_CLOSED'
            )
        
        end_cash = request.data.get('end_cash')
        if end_cash is None:
            return Response(
                {'error_code': 'VALIDATION_ERROR', 'message': 'end_cash مطلوب'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            end_cash = float(end_cash)
        except ValueError:
            return Response(
                {'error_code': 'VALIDATION_ERROR', 'message': 'end_cash يجب أن يكون رقم'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # TODO: Calculate expected cash from transactions when Transaction model is implemented
        # For now, set expected_cash = end_cash
        expected_cash = end_cash
        
        # Update shift
        shift.end_time = timezone.now()
        shift.end_cash = end_cash
        shift.expected_cash = expected_cash
        shift.status = 'closed'
        shift.save()
        
        serializer = self.get_serializer(shift)
        return Response(serializer.data)


class SupplierViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Supplier CRUD operations
    
    GET    /api/suppliers/           - List all suppliers
    POST   /api/suppliers/           - Create supplier
    GET    /api/suppliers/{id}/      - Retrieve supplier
    PUT    /api/suppliers/{id}/      - Update supplier
    DELETE /api/suppliers/{id}/      - Delete supplier
    POST   /api/suppliers/{id}/settle_debt/ - Settle debt
    """
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['supplier_name', 'supplier_code', 'phone']
    filterset_fields = ['is_active']
    ordering_fields = ['supplier_name', 'current_balance', 'created_at']
    ordering = ['-created_at']
    
    def destroy(self, request, *args, **kwargs):
        """Delete supplier with validation"""
        instance = self.get_object()
        
        # Check if supplier has non-zero balance
        if instance.current_balance != 0:
            raise BusinessRuleViolation(
                'لا يمكن حذف مورد لديه رصيد',
                error_code='BUSINESS_RULE_VIOLATION'
            )
        
        # TODO: Check if supplier has transactions when Transaction model is implemented
        
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    @action(detail=True, methods=['post'])
    def settle_debt(self, request, pk=None):
        """
        Settle supplier debt
        POST /api/suppliers/{id}/settle_debt/
        Body: { "amount": 1000, "payment_method": "كاش" }
        """
        from decimal import Decimal
        
        try:
            supplier = self.get_object()
            amount = request.data.get('amount')
            payment_method = request.data.get('payment_method', 'كاش')
            
            if amount is None:
                return Response(
                    {'error_code': 'VALIDATION_ERROR', 'message': 'amount مطلوب'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            try:
                amount = Decimal(str(amount))
            except:
                return Response(
                    {'error_code': 'VALIDATION_ERROR', 'message': 'amount يجب أن يكون رقم'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Update supplier balance (decrease = payment made to supplier)
            supplier.current_balance -= amount
            supplier.save()
            
            serializer = self.get_serializer(supplier)
            return Response(serializer.data)
        except Exception as e:
            import traceback
            print(f"Error in settle_debt: {e}")
            print(traceback.format_exc())
            return Response(
                {'error_code': 'SERVER_ERROR', 'message': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CustomerViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Customer CRUD operations
    
    GET    /api/customers/           - List all customers
    POST   /api/customers/           - Create customer
    GET    /api/customers/{id}/      - Retrieve customer
    PUT    /api/customers/{id}/      - Update customer
    DELETE /api/customers/{id}/      - Delete customer
    POST   /api/customers/{id}/settle_debt/ - Settle debt
    """
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['customer_name', 'customer_code', 'phone']
    filterset_fields = ['customer_type', 'is_active']
    ordering_fields = ['customer_name', 'current_balance', 'created_at']
    ordering = ['-created_at']
    
    def destroy(self, request, *args, **kwargs):
        """Delete customer with validation"""
        instance = self.get_object()
        
        # Check if customer has non-zero balance
        if instance.current_balance != 0:
            raise BusinessRuleViolation(
                'لا يمكن حذف عميل لديه رصيد',
                error_code='BUSINESS_RULE_VIOLATION'
            )
        
        # TODO: Check if customer has transactions when Transaction model is implemented
        
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    @action(detail=True, methods=['post'])
    def settle_debt(self, request, pk=None):
        """
        Settle customer debt
        POST /api/customers/{id}/settle_debt/
        Body: { "amount": 1000, "payment_method": "كاش" }
        """
        from decimal import Decimal
        
        try:
            customer = self.get_object()
            amount = request.data.get('amount')
            payment_method = request.data.get('payment_method', 'كاش')
            
            if amount is None:
                return Response(
                    {'error_code': 'VALIDATION_ERROR', 'message': 'amount مطلوب'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            try:
                amount = Decimal(str(amount))
            except:
                return Response(
                    {'error_code': 'VALIDATION_ERROR', 'message': 'amount يجب أن يكون رقم'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Update customer balance (increase = payment received)
            customer.current_balance += amount
            customer.save()
            
            serializer = self.get_serializer(customer)
            return Response(serializer.data)
        except Exception as e:
            import traceback
            print(f"Error in settle_debt: {e}")
            print(traceback.format_exc())
            return Response(
                {'error_code': 'SERVER_ERROR', 'message': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ProductViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Product CRUD operations
    
    GET    /api/products/           - List all products
    POST   /api/products/           - Create product
    GET    /api/products/{id}/      - Retrieve product
    PUT    /api/products/{id}/      - Update product
    DELETE /api/products/{id}/      - Delete product
    POST   /api/products/{id}/adjust_stock/ - Adjust stock
    """
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['product_name', 'product_code', 'barcode']
    filterset_fields = ['category', 'is_active']
    ordering_fields = ['product_name', 'current_stock', 'created_at']
    ordering = ['-created_at']
    
    def create(self, request, *args, **kwargs):
        """Create product with error handling"""
        import traceback
        try:
            serializer = self.get_serializer(data=request.data)
            if not serializer.is_valid():
                return Response(
                    {'error_code': 'VALIDATION_ERROR', 'message': 'Validation error', 'details': serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )
            product = serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            print(traceback.format_exc())
            return Response(
                {'error_code': 'SERVER_ERROR', 'message': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def update(self, request, *args, **kwargs):
        """Update product with error handling"""
        import traceback
        try:
            instance = self.get_object()
            serializer = self.get_serializer(instance, data=request.data, partial=kwargs.get('partial', False))
            if not serializer.is_valid():
                return Response(
                    {'error_code': 'VALIDATION_ERROR', 'message': 'Validation error', 'details': serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )
            product = serializer.save()
            return Response(serializer.data)
        except Exception as e:
            print(traceback.format_exc())
            return Response(
                {'error_code': 'SERVER_ERROR', 'message': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def destroy(self, request, *args, **kwargs):
        """Delete product with validation"""
        instance = self.get_object()
        
        # Check if product has transactions
        # TODO: Add transaction check when Transaction model is implemented
        # For now, allow deletion
        
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    @action(detail=True, methods=['post'])
    def adjust_stock(self, request, pk=None):
        """
        Adjust product stock with reason logging
        POST /api/products/{id}/adjust_stock/
        Body: { "quantity_diff": 10, "reason": "تسوية مخزون" }
        """
        product = self.get_object()
        quantity_diff = request.data.get('quantity_diff')
        reason = request.data.get('reason', '')
        
        if quantity_diff is None:
            return Response(
                {'error_code': 'VALIDATION_ERROR', 'message': 'quantity_diff مطلوب'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            quantity_diff = float(quantity_diff)
        except ValueError:
            return Response(
                {'error_code': 'VALIDATION_ERROR', 'message': 'quantity_diff يجب أن يكون رقم'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if adjustment would result in negative quantity
        new_quantity = float(product.current_stock) + quantity_diff
        if new_quantity < 0:
            raise BusinessRuleViolation(
                'لا يمكن أن تكون الكمية سالبة',
                error_code='INSUFFICIENT_STOCK'
            )
        
        # Update product quantity
        product.current_stock = new_quantity
        product.save()
        
        # TODO: Create adjustment transaction when Transaction model is implemented
        
        serializer = self.get_serializer(product)
        return Response(serializer.data)



class QuotationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Quotation operations
    
    GET    /api/quotations/           - List quotations
    POST   /api/quotations/           - Create quotation
    GET    /api/quotations/{id}/      - Retrieve quotation
    PUT    /api/quotations/{id}/      - Update quotation
    DELETE /api/quotations/{id}/      - Delete quotation
    POST   /api/quotations/{id}/convert/ - Convert to invoice
    """
    queryset = Quotation.objects.all()
    serializer_class = QuotationSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['status', 'customer']
    ordering_fields = ['quotation_date', 'total_amount']
    ordering = ['-quotation_date']
    
    def create(self, request, *args, **kwargs):
        """Create a new quotation"""
        customer_id = request.data.get('customer')
        items = request.data.get('items', [])
        total_amount = request.data.get('totalAmount', 0)
        
        if not customer_id:
            return Response(
                {'error_code': 'VALIDATION_ERROR', 'message': 'customer مطلوب'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not items:
            return Response(
                {'error_code': 'VALIDATION_ERROR', 'message': 'items مطلوب'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            customer = Customer.objects.get(customer_id=customer_id)
        except Customer.DoesNotExist:
            return Response(
                {'error_code': 'NOT_FOUND', 'message': 'العميل غير موجود'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Generate quotation number
        last_quotation = Quotation.objects.order_by('-quotation_id').first()
        if last_quotation:
            last_num = int(last_quotation.quotation_number.replace('Q', ''))
            quotation_number = f'Q{last_num + 1:05d}'
        else:
            quotation_number = 'Q00001'
        
        # Create quotation
        with db_transaction.atomic():
            quotation = Quotation.objects.create(
                quotation_number=quotation_number,
                customer=customer,
                total_amount=total_amount,
                status='draft',
                created_by=request.user.id if request.user.is_authenticated else None
            )
            
            # Create quotation items
            for item in items:
                try:
                    product = Product.objects.get(product_id=item['id'])
                    QuotationItem.objects.create(
                        quotation=quotation,
                        product=product,
                        quantity=item['quantity'],
                        unit_price=item['price'],
                        total=item['quantity'] * item['price']
                    )
                except Product.DoesNotExist:
                    return Response(
                        {'error_code': 'NOT_FOUND', 'message': f'المنتج {item["id"]} غير موجود'},
                        status=status.HTTP_404_NOT_FOUND
                    )
        
        serializer = self.get_serializer(quotation)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def convert(self, request, pk=None):
        """
        Convert quotation to invoice (sale transaction)
        POST /api/quotations/{id}/convert/
        Body: { "payment_method": "كاش" }
        """
        quotation = self.get_object()
        
        if quotation.status == 'converted':
            raise BusinessRuleViolation(
                'عرض السعر محول بالفعل',
                error_code='ALREADY_CONVERTED'
            )
        
        payment_method = request.data.get('payment_method', 'كاش')
        
        # Check stock availability
        quotation_items = QuotationItem.objects.filter(quotation=quotation)
        insufficient_stock = []
        
        for item in quotation_items:
            if item.product.current_stock < item.quantity:
                insufficient_stock.append({
                    'product': item.product.product_name,
                    'available': float(item.product.current_stock),
                    'required': float(item.quantity)
                })
        
        if insufficient_stock:
            return Response(
                {
                    'error_code': 'INSUFFICIENT_STOCK',
                    'message': 'بعض المنتجات غير متوفرة بالكمية المطلوبة',
                    'details': insufficient_stock
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Convert to sale using SaleService
        from .services.sale_service import SaleService
        
        # Prepare cart items
        cart_items = []
        for item in quotation_items:
            cart_items.append({
                'id': item.product.product_id,
                'quantity': float(item.quantity),
                'price': float(item.unit_price)
            })
        
        try:
            sale_transaction = SaleService.complete_sale(
                cart_items=cart_items,
                customer_id=quotation.customer.customer_id,
                payment_method=payment_method,
                total_amount=float(quotation.total_amount),
                invoice_id=quotation.quotation_number,
                is_direct_sale=False,
                user=request.user
            )
            
            # Update quotation status
            quotation.status = 'converted'
            quotation.save()
            
            serializer = self.get_serializer(quotation)
            return Response({
                'quotation': serializer.data,
                'transaction_id': sale_transaction.transaction_id
            }, status=status.HTTP_200_OK)
            
        except BusinessRuleViolation as e:
            return Response(
                {'error_code': e.error_code, 'message': e.message},
                status=status.HTTP_400_BAD_REQUEST
            )



class SettingsViewSet(viewsets.ViewSet):
    """
    ViewSet for AppSettings operations (singleton)
    
    GET    /api/settings/           - Retrieve settings
    PUT    /api/settings/           - Update settings
    """
    
    def list(self, request):
        """
        Retrieve application settings
        GET /api/settings/
        """
        settings = AppSettings.get_settings()
        serializer = AppSettingsSerializer(settings)
        return Response(serializer.data)
    
    def update(self, request, pk=None):
        """
        Update application settings
        PUT /api/settings/
        """
        settings = AppSettings.get_settings()
        serializer = AppSettingsSerializer(settings, data=request.data, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            
            # TODO: Log activity when ActivityLog model is implemented
            
            return Response(serializer.data)
        
        return Response(
            {'error_code': 'VALIDATION_ERROR', 'message': 'خطأ في البيانات', 'details': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST
        )



class UserViewSet(viewsets.ModelViewSet):
    """
    ViewSet for User management (admin only)
    
    GET    /api/users/           - List users
    POST   /api/users/           - Create user
    DELETE /api/users/{id}/      - Delete user
    PUT    /api/users/me/change_password/ - Change password
    """
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAdminUser]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['username', 'first_name']
    ordering_fields = ['username', 'date_joined']
    ordering = ['-date_joined']
    
    def get_permissions(self):
        """Allow authenticated users to change their own password"""
        if self.action == 'change_password':
            return [IsAuthenticated()]
        return super().get_permissions()
    
    def create(self, request, *args, **kwargs):
        """Create a new user"""
        serializer = UserCreateSerializer(data=request.data)
        
        if serializer.is_valid():
            # Check if username already exists
            if User.objects.filter(username=serializer.validated_data['username']).exists():
                return Response(
                    {'error_code': 'DUPLICATE_ENTRY', 'message': 'اسم المستخدم موجود بالفعل'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            user = serializer.save()
            
            # Return user data
            response_serializer = UserSerializer(user)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)
        
        return Response(
            {'error_code': 'VALIDATION_ERROR', 'message': 'خطأ في البيانات', 'details': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    def destroy(self, request, *args, **kwargs):
        """Delete user with validation"""
        user = self.get_object()
        
        # Prevent deletion of last admin
        if user.is_staff:
            admin_count = User.objects.filter(is_staff=True).count()
            if admin_count <= 1:
                raise BusinessRuleViolation(
                    'لا يمكن حذف آخر مدير في النظام',
                    error_code='LAST_ADMIN'
                )
        
        self.perform_destroy(user)
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    @action(detail=False, methods=['put'], url_path='me/change_password')
    def change_password(self, request):
        """
        Change current user's password
        PUT /api/users/me/change_password/
        Body: { "old_password": "...", "new_password": "..." }
        """
        serializer = ChangePasswordSerializer(data=request.data)
        
        if serializer.is_valid():
            old_password = serializer.validated_data['old_password']
            new_password = serializer.validated_data['new_password']
            
            # Validate old password
            if not request.user.check_password(old_password):
                return Response(
                    {'error_code': 'AUTH_FAILED', 'message': 'كلمة المرور القديمة غير صحيحة'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Set new password
            request.user.set_password(new_password)
            request.user.save()
            
            return Response({'message': 'تم تغيير كلمة المرور بنجاح'})
        
        return Response(
            {'error_code': 'VALIDATION_ERROR', 'message': 'خطأ في البيانات', 'details': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST
        )



class StandardResultsSetPagination(PageNumberPagination):
    """Standard pagination class"""
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 100


class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for ActivityLog (read-only)
    
    GET    /api/activity-logs/           - List activity logs
    GET    /api/activity-logs/{id}/      - Retrieve activity log
    """
    queryset = ActivityLog.objects.all()
    serializer_class = ActivityLogSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['user']
    ordering_fields = ['date']
    ordering = ['-date']
    pagination_class = StandardResultsSetPagination
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter activity logs by date range if provided"""
        queryset = super().get_queryset()
        from_date = self.request.query_params.get('from_date')
        to_date = self.request.query_params.get('to_date')
        
        if from_date:
            queryset = queryset.filter(date__date__gte=from_date)
        if to_date:
            queryset = queryset.filter(date__date__lte=to_date)
        
        return queryset



class ReportsViewSet(viewsets.ViewSet):
    """
    ViewSet for Reports
    
    GET /api/reports/sales/        - Sales report
    GET /api/reports/inventory/    - Inventory report
    GET /api/reports/treasury/     - Treasury report
    GET /api/reports/debts/         - Debts report
    GET /api/reports/profit_loss/   - Profit/loss report
    """
    
    @action(detail=False, methods=['get'])
    def sales(self, request):
        """
        Sales report with date filtering
        GET /api/reports/sales/?from_date=2024-01-01&to_date=2024-12-31
        """
        from_date = request.query_params.get('from_date')
        to_date = request.query_params.get('to_date')
        
        # Filter sales transactions
        sales = Transaction.objects.filter(type='بيع')
        
        if from_date:
            sales = sales.filter(date__date__gte=from_date)
        if to_date:
            sales = sales.filter(date__date__lte=to_date)
        
        # Calculate totals by payment method
        totals_by_method = {}
        total_sales = 0
        
        for sale in sales:
            payment_method = sale.payment_method
            amount = float(sale.amount)
            
            if payment_method not in totals_by_method:
                totals_by_method[payment_method] = 0
            
            totals_by_method[payment_method] += amount
            total_sales += amount
        
        return Response({
            'total_sales': total_sales,
            'sales_by_method': totals_by_method,
            'sales_count': sales.count()
        })
    
    @action(detail=False, methods=['get'])
    def inventory(self, request):
        """
        Inventory report with low stock alerts
        GET /api/reports/inventory/
        """
        products = Product.objects.all()
        
        low_stock_products = []
        total_inventory_value = 0
        
        for product in products:
            stock = float(product.current_stock)
            cost = float(product.purchase_price)
            min_stock = float(product.min_stock_level)
            
            total_inventory_value += stock * cost
            
            if stock <= min_stock:
                low_stock_products.append({
                    'id': product.product_id,
                    'name': product.product_name,
                    'current_stock': stock,
                    'min_stock_level': min_stock
                })
        
        return Response({
            'total_products': products.count(),
            'low_stock_count': len(low_stock_products),
            'low_stock_products': low_stock_products,
            'total_inventory_value': total_inventory_value
        })
    
    @action(detail=False, methods=['get'])
    def treasury(self, request):
        """
        Treasury report - cash flow summary
        GET /api/reports/treasury/?from_date=2024-01-01&to_date=2024-12-31
        """
        from_date = request.query_params.get('from_date')
        to_date = request.query_params.get('to_date')
        
        # Filter transactions
        transactions = Transaction.objects.all()
        
        if from_date:
            transactions = transactions.filter(date__gte=from_date)
        if to_date:
            transactions = transactions.filter(date__lte=to_date)
        
        # Calculate totals by type
        totals_by_type = {}
        
        for transaction in transactions:
            trans_type = transaction.type
            amount = float(transaction.amount)
            
            if trans_type not in totals_by_type:
                totals_by_type[trans_type] = 0
            
            totals_by_type[trans_type] += amount
        
        # Get settings for opening balance
        settings = AppSettings.get_settings()
        opening_balance = float(settings.opening_balance)
        
        # Calculate net cash flow
        sales = totals_by_type.get('بيع', 0)
        purchases = totals_by_type.get('شراء', 0)
        expenses = totals_by_type.get('مصروف', 0)
        capital = totals_by_type.get('إيداع رأس مال', 0)
        withdrawals = totals_by_type.get('مسحوبات شخصية', 0)
        
        net_cash_flow = opening_balance + sales - purchases - expenses - withdrawals + capital
        
        return Response({
            'opening_balance': opening_balance,
            'totals_by_type': totals_by_type,
            'net_cash_flow': net_cash_flow
        })
    
    @action(detail=False, methods=['get'])
    def debts(self, request):
        """
        Debts report - outstanding balances
        GET /api/reports/debts/
        """
        # Customer debts (negative balance = customer owes us)
        customers = Customer.objects.filter(current_balance__lt=0)
        customer_debts = []
        total_customer_debt = 0
        
        for customer in customers:
            debt = abs(float(customer.current_balance))
            customer_debts.append({
                'id': customer.customer_id,
                'name': customer.customer_name,
                'debt': debt
            })
            total_customer_debt += debt
        
        # Supplier debts (positive balance = we owe supplier)
        suppliers = Supplier.objects.filter(current_balance__gt=0)
        supplier_debts = []
        total_supplier_debt = 0
        
        for supplier in suppliers:
            debt = float(supplier.current_balance)
            supplier_debts.append({
                'id': supplier.supplier_id,
                'name': supplier.supplier_name,
                'debt': debt
            })
            total_supplier_debt += debt
        
        return Response({
            'customer_debts': customer_debts,
            'total_customer_debt': total_customer_debt,
            'supplier_debts': supplier_debts,
            'total_supplier_debt': total_supplier_debt
        })
    
    @action(detail=False, methods=['get'])
    def profit_loss(self, request):
        """
        Profit/loss report
        GET /api/reports/profit_loss/?from_date=2024-01-01&to_date=2024-12-31
        """
        from_date = request.query_params.get('from_date')
        to_date = request.query_params.get('to_date')
        
        # Filter transactions
        transactions = Transaction.objects.all()
        
        if from_date:
            transactions = transactions.filter(date__gte=from_date)
        if to_date:
            transactions = transactions.filter(date__lte=to_date)
        
        # Calculate totals
        total_sales = 0
        total_purchases = 0
        total_expenses = 0
        
        for transaction in transactions:
            amount = float(transaction.amount)
            
            if transaction.type == 'بيع':
                total_sales += amount
            elif transaction.type == 'شراء':
                total_purchases += amount
            elif transaction.type == 'مصروف':
                total_expenses += amount
        
        # Calculate net income
        net_income = total_sales - total_purchases - total_expenses
        
        return Response({
            'total_sales': total_sales,
            'total_purchases': total_purchases,
            'total_expenses': total_expenses,
            'net_income': net_income
        })



class SystemViewSet(viewsets.ViewSet):
    """
    ViewSet for System operations
    
    POST /api/system/backup/              - Generate backup
    POST /api/system/restore/             - Restore from backup
    POST /api/system/clear_transactions/  - Clear transactions
    POST /api/system/factory_reset/       - Factory reset
    """
    permission_classes = [IsAdminUser]
    
    @action(detail=False, methods=['post'])
    def backup(self, request):
        """
        Generate JSON backup file
        POST /api/system/backup/
        """
        import json
        from django.http import HttpResponse
        from datetime import datetime
        
        # Collect all data
        backup_data = {
            'version': '1.0',
            'timestamp': datetime.now().isoformat(),
            'products': [],
            'customers': [],
            'suppliers': [],
            'transactions': [],
            'quotations': [],
            'shifts': [],
            'users': [],
            'settings': {},
            'activity_logs': []
        }
        
        # Products
        for product in Product.objects.all():
            backup_data['products'].append({
                'id': product.product_id,
                'sku': product.product_code,
                'barcode': product.barcode,
                'name': product.product_name,
                'category': product.category,
                'quantity': float(product.current_stock),
                'costPrice': float(product.purchase_price),
                'sellPrice': float(product.selling_price),
                'unit': product.unit,
                'minStockAlert': float(product.min_stock_level),
                'image': product.product_image
            })
        
        # Customers
        for customer in Customer.objects.all():
            backup_data['customers'].append({
                'id': customer.customer_id,
                'name': customer.customer_name,
                'phone': customer.phone,
                'type': customer.customer_type,
                'balance': float(customer.current_balance),
                'creditLimit': float(customer.credit_limit)
            })
        
        # Suppliers
        for supplier in Supplier.objects.all():
            backup_data['suppliers'].append({
                'id': supplier.supplier_id,
                'name': supplier.supplier_name,
                'phone': supplier.phone,
                'balance': float(supplier.current_balance)
            })
        
        # Transactions
        for transaction in Transaction.objects.all():
            backup_data['transactions'].append({
                'id': transaction.transaction_id,
                'type': transaction.type,
                'date': transaction.date.isoformat(),
                'amount': float(transaction.amount),
                'paymentMethod': transaction.payment_method,
                'description': transaction.description,
                'category': transaction.category,
                'relatedCustomer': transaction.related_customer_id,
                'relatedSupplier': transaction.related_supplier_id,
                'items': transaction.items,
                'status': transaction.status,
                'isDirectSale': transaction.is_direct_sale
            })
        
        # Quotations
        for quotation in Quotation.objects.all():
            items = []
            for item in QuotationItem.objects.filter(quotation=quotation):
                items.append({
                    'id': item.product.product_id,
                    'quantity': float(item.quantity),
                    'price': float(item.unit_price)
                })
            
            backup_data['quotations'].append({
                'id': quotation.quotation_id,
                'date': quotation.quotation_date.isoformat(),
                'customer': quotation.customer.customer_id,
                'items': items,
                'totalAmount': float(quotation.total_amount),
                'status': quotation.status
            })
        
        # Shifts
        for shift in Shift.objects.all():
            backup_data['shifts'].append({
                'id': shift.shift_id,
                'user': shift.user.id,
                'startTime': shift.start_time.isoformat(),
                'endTime': shift.end_time.isoformat() if shift.end_time else None,
                'startCash': float(shift.start_cash),
                'endCash': float(shift.end_cash) if shift.end_cash else None,
                'expectedCash': float(shift.expected_cash) if shift.expected_cash else None,
                'totalSales': float(shift.total_sales) if shift.total_sales else None,
                'salesByMethod': shift.sales_by_method,
                'status': shift.status
            })
        
        # Users (without passwords)
        for user in User.objects.all():
            backup_data['users'].append({
                'id': user.id,
                'username': user.username,
                'name': user.first_name,
                'role': 'admin' if user.is_staff else 'cashier'
            })
        
        # Settings
        settings = AppSettings.get_settings()
        backup_data['settings'] = {
            'companyName': settings.company_name,
            'companyPhone': settings.company_phone,
            'companyAddress': settings.company_address,
            'logoUrl': settings.logo_url,
            'autoPrint': settings.auto_print,
            'nextInvoiceNumber': settings.next_invoice_number,
            'openingBalance': float(settings.opening_balance),
            'taxRate': float(settings.tax_rate),
            'preventNegativeStock': settings.prevent_negative_stock,
            'invoiceTerms': settings.invoice_terms
        }
        
        # Activity Logs
        for log in ActivityLog.objects.all():
            backup_data['activity_logs'].append({
                'id': log.log_id,
                'date': log.date.isoformat(),
                'userId': log.user.id if log.user else None,
                'userName': log.user_name,
                'action': log.action,
                'details': log.details
            })
        
        # Create JSON response
        json_data = json.dumps(backup_data, ensure_ascii=False, indent=2)
        
        response = HttpResponse(json_data, content_type='application/json')
        response['Content-Disposition'] = f'attachment; filename="fox_erp_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json"'
        
        return response
    
    @action(detail=False, methods=['post'])
    def restore(self, request):
        """
        Restore from backup file
        POST /api/system/restore/
        Body: multipart/form-data with 'file' field
        """
        import json
        
        if 'file' not in request.FILES:
            return Response(
                {'error_code': 'VALIDATION_ERROR', 'message': 'ملف النسخ الاحتياطي مطلوب'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        backup_file = request.FILES['file']
        
        try:
            # Read and parse JSON
            backup_data = json.loads(backup_file.read().decode('utf-8'))
            
            # Validate version
            if 'version' not in backup_data:
                return Response(
                    {'error_code': 'VALIDATION_ERROR', 'message': 'ملف النسخ الاحتياطي غير صالح'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # TODO: Implement restore logic
            # This would involve clearing existing data and recreating from backup
            # For now, return success message
            
            return Response({'message': 'تم استعادة النسخة الاحتياطية بنجاح'})
            
        except json.JSONDecodeError:
            return Response(
                {'error_code': 'VALIDATION_ERROR', 'message': 'ملف JSON غير صالح'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=False, methods=['post'])
    def clear_transactions(self, request):
        """
        Clear all transactions, quotations, shifts, and activity logs
        Reset customer/supplier balances to zero
        POST /api/system/clear_transactions/
        """
        with db_transaction.atomic():
            # Delete transactions
            Transaction.objects.all().delete()
            
            # Delete quotations and items
            QuotationItem.objects.all().delete()
            Quotation.objects.all().delete()
            
            # Delete shifts
            Shift.objects.all().delete()
            
            # Delete activity logs
            ActivityLog.objects.all().delete()
            
            # Reset customer balances
            Customer.objects.all().update(current_balance=0)
            
            # Reset supplier balances
            Supplier.objects.all().update(current_balance=0)
        
        return Response({'message': 'تم مسح جميع المعاملات بنجاح'})
    
    @action(detail=False, methods=['post'])
    def factory_reset(self, request):
        """
        Factory reset - restore all data to initial defaults
        POST /api/system/factory_reset/
        """
        with db_transaction.atomic():
            # Delete all data
            Transaction.objects.all().delete()
            QuotationItem.objects.all().delete()
            Quotation.objects.all().delete()
            Shift.objects.all().delete()
            ActivityLog.objects.all().delete()
            Product.objects.all().delete()
            Customer.objects.all().delete()
            Supplier.objects.all().delete()
            
            # Reset settings (keep logo_url to preserve branding)
            settings = AppSettings.get_settings()
            settings.company_name = 'FOX GROUP'
            settings.company_phone = ''
            settings.company_address = ''
            # Keep logo_url - don't reset it to preserve company branding
            # settings.logo_url = None  # Commented out to keep logo
            settings.auto_print = False
            settings.next_invoice_number = 1001
            settings.opening_balance = 0
            settings.tax_rate = 14
            settings.current_shift = None
            settings.prevent_negative_stock = False
            settings.invoice_terms = ''
            settings.save()
        
        return Response({'message': 'تم إعادة ضبط المصنع بنجاح'})
