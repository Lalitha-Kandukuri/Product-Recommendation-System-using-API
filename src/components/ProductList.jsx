import React from 'react';
import ProductCard from './ProductCard';

export default function ProductList({ products }) {
  if (products.length === 0) {
    return (
      <div className="empty-catalog">
        <p>No products match your search criteria. Try asking for phones, laptops, or headphones under different price limits!</p>
      </div>
    );
  }

  return (
    <div className="product-grid">
      {products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
