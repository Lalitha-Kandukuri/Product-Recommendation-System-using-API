import React from 'react';

export default function ProductCard({ product }) {
  return (
    <div className="product-card">
      <h3 className="card-title">{product.name}</h3>
      <div className="card-meta">
        {product.category} &nbsp;•&nbsp; <strong>${product.price}</strong>
      </div>
      <p className="card-description">{product.description}</p>
    </div>
  );
}
