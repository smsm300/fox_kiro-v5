import React from 'react';
import { Search, ScanBarcode, Box } from 'lucide-react';
import { Product, CartItem } from '../../types';

interface ProductSelectorProps {
  products: Product[];
  searchTerm: string;
  selectedCategory: string;
  onSearchChange: (value: string) => void;
  onCategoryChange: (category: string) => void;
  onAddToCart: (product: Product) => void;
  searchInputRef: React.RefObject<HTMLInputElement>;
}

export const ProductSelector: React.FC<ProductSelectorProps> = ({
  products,
  searchTerm,
  selectedCategory,
  onSearchChange,
  onCategoryChange,
  onAddToCart,
  searchInputRef
}) => {
  // Ensure products is always an array
  const safeProducts = Array.isArray(products) ? products : [];

  const categories = ['all', ...Array.from(new Set(safeProducts.map(p => p.category)))];

  const filteredProducts = safeProducts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ((p as any).barcode && (p as any).barcode.includes(searchTerm));
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute right-3 top-3 text-gray-500" size={20} />
        <ScanBarcode className="absolute left-3 top-3 text-fox-500" size={20} />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="ابحث بالاسم أو الباركود أو SKU..."
          className="w-full bg-dark-900 border border-dark-700 text-white pr-10 pl-10 py-3 rounded-lg focus:border-fox-500 outline-none"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => onCategoryChange(cat)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${selectedCategory === cat
              ? 'bg-fox-500 text-white shadow-md'
              : 'bg-dark-900 text-gray-400 hover:bg-dark-800 border border-dark-700'
              }`}
          >
            {cat === 'all' ? 'الكل' : cat}
          </button>
        ))}
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[calc(100vh-400px)] overflow-y-auto custom-scrollbar">
        {filteredProducts.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            <Box size={48} className="mx-auto mb-4 opacity-30" />
            <p>لا توجد منتجات</p>
          </div>
        ) : (
          filteredProducts.map(product => (
            <button
              key={product.id}
              onClick={() => onAddToCart(product)}
              disabled={product.quantity === 0}
              className={`bg-dark-900 border border-dark-700 rounded-lg p-3 text-right hover:border-fox-500 transition-all group relative overflow-hidden flex flex-col h-full ${product.quantity === 0 ? 'opacity-50 cursor-not-allowed' : ''
                }`}
            >
              {/* Product Image */}
              <div className="w-full h-32 mb-2 bg-dark-800 rounded-md overflow-hidden flex-shrink-0">
                <img
                  src={product.image || '/fox-logo.png'}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (target.src.includes('fox-logo.png')) {
                      target.style.display = 'none';
                      // Fallback HTML if even the logo fails
                      if (target.parentElement) {
                        target.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center text-dark-600"><svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg></div>';
                      }
                    } else {
                      target.src = '/fox-logo.png';
                    }
                  }}
                />
              </div>

              <div className="flex justify-between items-start w-full">
                <span className={`text-xs px-2 py-0.5 rounded ${product.quantity === 0 ? 'bg-red-900/30 text-red-400' :
                  product.quantity <= product.minStockAlert ? 'bg-yellow-900/30 text-yellow-400' :
                    'bg-emerald-900/30 text-emerald-400'
                  }`}>
                  {product.quantity} {product.unit}
                </span>
              </div>
              <h3 className="font-bold text-white text-sm mb-1 group-hover:text-fox-400 transition-colors line-clamp-2 w-full">
                {product.name}
              </h3>
              <div className="mt-auto w-full">
                <p className="text-xs text-gray-500 mb-1">{product.sku}</p>
                <p className="text-lg font-bold text-fox-400">{product.sellPrice.toLocaleString()} ج.م</p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};
