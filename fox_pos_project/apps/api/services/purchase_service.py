from decimal import Decimal
from django.db import transaction
from apps.products.models import Product
from apps.suppliers.models import Supplier
from ..models import Transaction, Shift
from ..exceptions import BusinessRuleViolation
import uuid


class PurchaseService:
    """Service for handling purchase transaction logic"""
    
    @staticmethod
    @transaction.atomic
    def complete_purchase(cart_items, supplier_id, payment_method, total_amount, user=None):
        """
        Complete a purchase transaction
        
        Args:
            cart_items: List of items with {id, quantity, cost_price}
            supplier_id: Supplier ID
            payment_method: Payment method (كاش, محفظة, Instapay, آجل)
            total_amount: Total purchase amount
            user: User performing the purchase
        
        Returns:
            Transaction object
        """
        
        # 1. Get supplier
        try:
            supplier = Supplier.objects.get(supplier_id=supplier_id)
        except Supplier.DoesNotExist:
            raise BusinessRuleViolation(
                'المورد غير موجود',
                error_code='NOT_FOUND'
            )
        
        # 2. Generate transaction ID
        transaction_id = f"PUR-{uuid.uuid4().hex[:12].upper()}"
        
        # 3. Get user's current shift (if user provided)
        open_shift = None
        if user:
            open_shift = Shift.objects.filter(user=user, status='open').first()
        
        # 4. Enrich cart items with product names before saving
        enriched_items = []
        for item in cart_items:
            product_id = item.get('id')
            try:
                product = Product.objects.get(product_id=product_id)
                enriched_items.append({
                    'id': product_id,
                    'name': product.product_name,
                    'quantity': item.get('quantity', 0),
                    'cost_price': float(item.get('cost_price', 0)),
                })
            except Product.DoesNotExist:
                enriched_items.append({
                    'id': product_id,
                    'name': f'منتج #{product_id}',
                    'quantity': item.get('quantity', 0),
                    'cost_price': float(item.get('cost_price', 0)),
                })
        
        # 5. Create transaction record with enriched items
        purchase_transaction = Transaction.objects.create(
            transaction_id=transaction_id,
            type='شراء',
            amount=total_amount,
            payment_method=payment_method,
            items=enriched_items,
            related_supplier=supplier,
            shift=open_shift,
            created_by=user,
            status='completed'
        )
        
        # 6. Update product quantities and calculate average cost
        for item in cart_items:
            try:
                product = Product.objects.get(product_id=item['id'])
            except Product.DoesNotExist:
                raise BusinessRuleViolation(
                    f'المنتج غير موجود: {item["id"]}',
                    error_code='NOT_FOUND'
                )
            
            old_quantity = product.current_stock
            old_cost = product.purchase_price
            new_quantity = Decimal(str(item['quantity']))
            new_cost = Decimal(str(item.get('cost_price', item.get('price', 0))))
            
            # Calculate weighted average cost
            if old_quantity + new_quantity > 0:
                avg_cost = (old_quantity * old_cost + new_quantity * new_cost) / (old_quantity + new_quantity)
                product.purchase_price = avg_cost
            
            # Update quantity
            product.current_stock += new_quantity
            product.save()
        
        # 7. Update supplier balance (if deferred)
        if payment_method == 'آجل':
            supplier.current_balance += Decimal(str(total_amount))
            supplier.save()
        
        # 7. TODO: Log activity
        
        return purchase_transaction
    
    @staticmethod
    @transaction.atomic
    def process_return(transaction_id, user=None):
        """
        Process a purchase return
        
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
        
        if original_transaction.type != 'شراء':
            raise BusinessRuleViolation(
                'يمكن إرجاع معاملات الشراء فقط',
                error_code='INVALID_TYPE'
            )
        
        # Validate quantities won't go negative
        for item in original_transaction.items:
            product = Product.objects.get(product_id=item['id'])
            if product.current_stock < Decimal(str(item['quantity'])):
                raise BusinessRuleViolation(
                    f'الكمية غير كافية للإرجاع: {product.product_name}',
                    error_code='INSUFFICIENT_STOCK'
                )
        
        # Get user's current shift (if user provided)
        open_shift = None
        if user:
            open_shift = Shift.objects.filter(user=user, status='open').first()
        
        # Create return transaction
        return_transaction = Transaction.objects.create(
            transaction_id=f"PRET-{uuid.uuid4().hex[:12].upper()}",
            type='مرتجع',
            amount=original_transaction.amount,
            payment_method=original_transaction.payment_method,
            items=original_transaction.items,
            related_supplier=original_transaction.related_supplier,
            shift=open_shift,
            created_by=user,
            status='completed',
            description=f'مرتجع من {transaction_id}'
        )
        
        # Decrease product quantities
        for item in original_transaction.items:
            product = Product.objects.get(product_id=item['id'])
            product.current_stock -= Decimal(str(item['quantity']))
            product.save()
        
        # Adjust supplier balance (if deferred)
        if original_transaction.payment_method == 'آجل' and original_transaction.related_supplier:
            supplier = original_transaction.related_supplier
            supplier.current_balance -= Decimal(str(original_transaction.amount))
            supplier.save()
        
        return return_transaction
