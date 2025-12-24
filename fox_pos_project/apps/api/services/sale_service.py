from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from apps.products.models import Product
from apps.customers.models import Customer
from ..models import Transaction, Shift
from ..exceptions import BusinessRuleViolation
import uuid


class SaleService:
    """Service for handling sale transaction logic"""
    
    @staticmethod
    @transaction.atomic
    def complete_sale(cart_items, customer_id, payment_method, total_amount, 
                      invoice_id=None, is_direct_sale=False, user=None):
        """
        Complete a sale transaction
        
        Args:
            cart_items: List of items with {id, quantity, price}
            customer_id: Customer ID (optional)
            payment_method: Payment method (كاش, محفظة, Instapay, آجل)
            total_amount: Total sale amount
            invoice_id: Custom invoice ID (optional)
            is_direct_sale: Whether this is a direct sale (no inventory deduction)
            user: User performing the sale
        
        Returns:
            Transaction object
        
        Raises:
            BusinessRuleViolation: If business rules are violated
        """
        
        # 1. Validate shift is open (only for non-admin users)
        open_shift = None
        if user and not user.is_staff:
            # Non-admin users MUST have an open shift
            open_shift = Shift.objects.filter(user=user, status='open').first()
            if not open_shift:
                raise BusinessRuleViolation(
                    'يجب فتح الوردية أولاً',
                    error_code='SHIFT_NOT_OPEN'
                )
        elif user and user.is_staff:
            # Admin can work with or without a shift
            open_shift = Shift.objects.filter(user=user, status='open').first()
        
        # 2. Get customer if provided
        customer = None
        if customer_id:
            try:
                customer = Customer.objects.get(customer_id=customer_id)
            except Customer.DoesNotExist:
                raise BusinessRuleViolation(
                    'العميل غير موجود',
                    error_code='NOT_FOUND'
                )
        
        # 3. Validate customer type for deferred payment
        if payment_method == 'آجل':
            if not customer:
                raise BusinessRuleViolation(
                    'يجب تحديد عميل للدفع الآجل',
                    error_code='VALIDATION_ERROR'
                )
            if customer.customer_type == 'consumer':
                raise BusinessRuleViolation(
                    'لا يمكن البيع بالآجل للمستهلك',
                    error_code='BUSINESS_RULE_VIOLATION'
                )
        
        # 4. Validate stock availability (if not direct sale)
        if not is_direct_sale:
            for item in cart_items:
                try:
                    product = Product.objects.get(product_id=item['id'])
                    qty = item.get('quantity', item.get('cartQuantity', 0))
                    if product.current_stock < Decimal(str(qty)):
                        raise BusinessRuleViolation(
                            f'الكمية غير متوفرة للمنتج: {product.product_name}',
                            error_code='INSUFFICIENT_STOCK'
                        )
                except Product.DoesNotExist:
                    raise BusinessRuleViolation(
                        f'المنتج غير موجود: {item["id"]}',
                        error_code='NOT_FOUND'
                    )
        
        # 5. Validate customer credit limit (if deferred)
        if payment_method == 'آجل' and customer:
            new_balance = customer.current_balance - Decimal(str(total_amount))
            if new_balance < -customer.credit_limit:
                raise BusinessRuleViolation(
                    'تم تجاوز حد الائتمان',
                    error_code='CREDIT_LIMIT_EXCEEDED'
                )
        
        # 6. Generate transaction ID
        if not invoice_id:
            invoice_id = f"INV-{uuid.uuid4().hex[:12].upper()}"
        
        # 7. Enrich items with product names for storage
        enriched_items = []
        for item in cart_items:
            try:
                product = Product.objects.get(product_id=item['id'])
                enriched_items.append({
                    'id': item['id'],
                    'name': product.product_name,
                    'quantity': item.get('quantity', item.get('cartQuantity', 0)),
                    'price': float(item.get('price', item.get('sellPrice', 0))),
                    'costPrice': float(product.purchase_price),
                    'sellPrice': float(product.selling_price),
                    'discount': float(item.get('discount', 0))
                })
            except Product.DoesNotExist:
                enriched_items.append(item)
        
        # 8. Create transaction record
        sale_transaction = Transaction.objects.create(
            transaction_id=invoice_id,
            type='بيع',
            amount=total_amount,
            payment_method=payment_method,
            items=enriched_items,
            related_customer=customer,
            is_direct_sale=is_direct_sale,
            shift=open_shift,
            created_by=user,
            status='completed'
        )
        
        # 9. Update product quantities (if not direct sale)
        if not is_direct_sale:
            for item in cart_items:
                product = Product.objects.get(product_id=item['id'])
                qty = item.get('quantity', item.get('cartQuantity', 0))
                product.current_stock -= Decimal(str(qty))
                product.save()
        
        # 10. Create expense for COGS (if direct sale)
        if is_direct_sale:
            # Calculate cost of goods sold
            cogs = sum(Decimal(str(item.get('cost', 0))) * Decimal(str(item['quantity'])) 
                      for item in cart_items)
            
            Transaction.objects.create(
                transaction_id=f"EXP-{uuid.uuid4().hex[:12].upper()}",
                type='مصروف',
                amount=cogs,
                payment_method='كاش',
                description=f'تكلفة بضاعة مباعة - {invoice_id}',
                category='تكلفة بضاعة',
                shift=open_shift,
                created_by=user,
                status='completed'
            )
        
        # 11. Update customer balance (if deferred)
        if payment_method == 'آجل' and customer:
            customer.current_balance -= Decimal(str(total_amount))
            customer.save()
        
        # 12. TODO: Increment invoice number in settings
        # 13. TODO: Log activity
        
        return sale_transaction
    
    @staticmethod
    @transaction.atomic
    def process_return(transaction_id, user=None):
        """
        Process a sales return
        
        Args:
            transaction_id: Original transaction ID
            user: User processing the return
        
        Returns:
            Return transaction object
        """
        # Get original transaction
        try:
            original_transaction = Transaction.objects.get(transaction_id=transaction_id)
        except Transaction.DoesNotExist:
            raise BusinessRuleViolation(
                'المعاملة غير موجودة',
                error_code='NOT_FOUND'
            )
        
        if original_transaction.type != 'بيع':
            raise BusinessRuleViolation(
                'يمكن إرجاع معاملات البيع فقط',
                error_code='INVALID_TYPE'
            )
        
        # Get user's current shift (if user provided)
        open_shift = None
        if user:
            open_shift = Shift.objects.filter(user=user, status='open').first()
        
        # Create return transaction
        return_transaction = Transaction.objects.create(
            transaction_id=f"RET-{uuid.uuid4().hex[:12].upper()}",
            type='مرتجع',
            amount=original_transaction.amount,
            payment_method=original_transaction.payment_method,
            items=original_transaction.items,
            related_customer=original_transaction.related_customer,
            is_direct_sale=original_transaction.is_direct_sale,
            shift=open_shift,
            created_by=user,
            status='completed',
            description=f'مرتجع من {transaction_id}'
        )
        
        # Restore product quantities (unless direct sale)
        if not original_transaction.is_direct_sale:
            for item in original_transaction.items:
                product = Product.objects.get(product_id=item['id'])
                product.current_stock += Decimal(str(item['quantity']))
                product.save()
        
        # Adjust customer balance (if deferred)
        if original_transaction.payment_method == 'آجل' and original_transaction.related_customer:
            customer = original_transaction.related_customer
            customer.current_balance += Decimal(str(original_transaction.amount))
            customer.save()
        
        return return_transaction
