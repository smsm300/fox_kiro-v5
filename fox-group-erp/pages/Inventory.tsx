import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search } from 'lucide-react';
import { Product } from '../types';
import { ProductForm } from '../components/inventory/ProductForm';
import { ProductList } from '../components/inventory/ProductList';
import { StockAdjustment } from '../components/inventory/StockAdjustment';
import { productsAPI } from '../services/endpoints';
import { handleAPIError } from '../services/errorHandler';

interface InventoryProps {
  onProductsChange?: () => void;
}

const Inventory: React.FC<InventoryProps> = ({ onProductsChange }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isStockAdjustmentOpen, setIsStockAdjustmentOpen] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await productsAPI.list();
      // Handle both paginated and non-paginated responses
      const productsData = (response.data as any).results || response.data;
      setProducts(Array.isArray(productsData) ? productsData : []);
    } catch (err: any) {
      alert(handleAPIError(err));
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const [formData, setFormData] = useState<Omit<Product, 'id'>>({
    sku: '',
    name: '',
    category: '',
    quantity: 0,
    costPrice: 0,
    sellPrice: 0,
    unit: 'قطعة',
    minStockAlert: 5,
    image: '',
    barcode: ''
  });

  const categories = ['all', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];
  const existingCategories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
  const existingUnits = Array.from(new Set(products.map(p => p.unit).filter(Boolean)));

  const filteredProducts = useMemo(() => products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  }), [products, searchTerm, selectedCategory]);

  const handleOpenForm = () => {
    setEditingProduct(null);
    setFormData({
      sku: '',
      name: '',
      category: '',
      quantity: 0,
      costPrice: 0,
      sellPrice: 0,
      unit: 'قطعة',
      minStockAlert: 5,
      image: '',
      barcode: ''
    });
    setIsFormOpen(true);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      sku: product.sku,
      name: product.name,
      category: product.category,
      quantity: product.quantity,
      costPrice: product.costPrice,
      sellPrice: product.sellPrice,
      unit: product.unit,
      minStockAlert: product.minStockAlert,
      image: product.image || '',
      barcode: product.barcode || ''
    });
    setIsFormOpen(true);
  };

  const handleSubmit = async (data: Omit<Product, 'id'>) => {
    setLoading(true);
    try {
      if (editingProduct) {
        const response = await productsAPI.update(editingProduct.id, data);
        console.log('✏️ Update Response:', response);
        alert('تم تحديث المنتج بنجاح');
      } else {
        const response = await productsAPI.create(data);
        console.log('➕ Create Response:', response);
        alert('تم إضافة المنتج بنجاح');
      }
      setIsFormOpen(false);
      console.log('🔄 Fetching products after save...');
      await fetchProducts();
      // Notify parent to refresh products in other pages
      onProductsChange?.();
      console.log('✅ Products fetched, count:', products.length);
    } catch (err: any) {
      console.error('❌ Error in handleSubmit:', err);
      alert(handleAPIError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (field: keyof Omit<Product, 'id'>, value: any) => {
    console.log('📝 Form change:', field, '=', value);
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      console.log('📝 New formData:', newData);
      return newData;
    });
  };

  const handleAdjustStock = (product: Product) => {
    setAdjustingProduct(product);
    setIsStockAdjustmentOpen(true);
  };

  const handleStockAdjustment = async (productId: number, quantity: number, reason: string) => {
    setLoading(true);
    try {
      await productsAPI.adjustStock(productId, { quantity_diff: quantity, reason });
      alert('تم تعديل المخزون بنجاح');
      setIsStockAdjustmentOpen(false);
      await fetchProducts();
      onProductsChange?.();
    } catch (err: any) {
      alert(handleAPIError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
      setLoading(true);
      try {
        await productsAPI.delete(id);
        alert('تم حذف المنتج بنجاح');
        await fetchProducts();
        onProductsChange?.();
      } catch (err: any) {
        alert(handleAPIError(err));
      } finally {
        setLoading(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">جاري التحميل...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-dark-950 p-4 rounded-xl border border-dark-800 gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute right-3 top-2.5 text-gray-500" size={20} />
            <input
              type="text"
              placeholder="ابحث بالاسم أو SKU أو الباركود..."
              className="w-full bg-dark-900 border border-dark-700 text-white pr-10 pl-4 py-2 rounded-lg focus:border-fox-500 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <button
          onClick={handleOpenForm}
          className="flex items-center gap-2 bg-fox-500 text-white px-4 py-2 rounded-lg font-bold hover:bg-fox-600 transition-colors whitespace-nowrap"
        >
          <Plus size={20} />
          إضافة منتج
        </button>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${selectedCategory === cat
              ? 'bg-fox-500 text-white shadow-md'
              : 'bg-dark-900 text-gray-400 hover:bg-dark-800 border border-dark-700'
              }`}
          >
            {cat === 'all' ? 'الكل' : cat}
          </button>
        ))}
      </div>

      {/* Products Table */}
      <div className="bg-dark-950 rounded-xl border border-dark-800 p-6">
        <ProductList
          products={filteredProducts}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onAdjustStock={handleAdjustStock}
        />
      </div>

      {/* Product Form Modal */}
      <ProductForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleSubmit}
        editingProduct={editingProduct}
        formData={formData}
        onFormChange={handleFormChange}
        existingCategories={existingCategories}
        existingUnits={existingUnits}
      />

      {/* Stock Adjustment Modal */}
      <StockAdjustment
        isOpen={isStockAdjustmentOpen}
        onClose={() => setIsStockAdjustmentOpen(false)}
        product={adjustingProduct}
        onAdjust={handleStockAdjustment}
      />
    </div>
  );
};

export default Inventory;
