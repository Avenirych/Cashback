import React, { useState } from 'react';
import { fetchJson } from '../api';
import { Product } from '../types';

export const BrandCategorySeller: React.FC = () => {
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [sellerId, setSellerId] = useState('');
  const [products, setProducts] = useState<Product[]>([]);

  const loadBrand = () =>
    fetchJson<Product[]>(`/products/top/brand/${encodeURIComponent(brand)}`).then(setProducts);

  const loadCategory = () =>
    fetchJson<Product[]>(`/products/top/category/${encodeURIComponent(category)}`).then(setProducts);

  const loadSeller = () =>
    fetchJson<Product[]>(`/products/top/seller/${sellerId}`).then(setProducts);

  return (
    <div style={{ padding: 24 }}>
      <h1>Лучшие предложения по бренду / категории / продавцу</h1>

      <div style={{ marginBottom: 16 }}>
        <input
          placeholder="Бренд"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
        />
        <button onClick={loadBrand} style={{ marginLeft: 8 }}>
          По бренду
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input
          placeholder="Категория"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <button onClick={loadCategory} style={{ marginLeft: 8 }}>
          По категории
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input
          placeholder="ID продавца"
          value={sellerId}
          onChange={(e) => setSellerId(e.target.value)}
        />
        <button onClick={loadSeller} style={{ marginLeft: 8 }}>
          По продавцу
        </button>
      </div>

      <div>
        {products.map((p) => (
          <div key={p.id} style={{ border: '1px solid #ddd', padding: 16, marginBottom: 8 }}>
            <h2>{p.title}</h2>
            {p.brand && <p>Бренд: {p.brand}</p>}
            {p.seller && <p>Продавец: {p.seller.name}</p>}
            <p>Индекс выгоды: {p.best_offer_score}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
