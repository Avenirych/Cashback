import React, { useEffect, useState } from 'react';
import { fetchJson } from '../api';
import { Product } from '../types';
import { BestOfferBars } from '../components/BestOfferBars';

export const ProductsList: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [sort, setSort] = useState<string>('best_offer');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchJson<Product[]>(`/products?sort=${sort}`)
      .then(setProducts)
      .finally(() => setLoading(false));
  }, [sort]);

  return (
    <div style={{ padding: 24 }}>
      <h1>Каталог товаров</h1>

      <div style={{ marginBottom: 16 }}>
        <label>Сортировка: </label>
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="best_offer">Лучшее предложение</option>
          <option value="price_asc">Цена ↑</option>
          <option value="price_desc">Цена ↓</option>
          <option value="discount">Скидка</option>
          <option value="cashback">Кэшбэк</option>
          <option value="new">Новинки</option>
        </select>
      </div>

      {loading && <p>Загрузка...</p>}

      <div style={{ display: 'grid', gap: 16 }}>
        {products.map((p) => (
          <div
            key={p.id}
            style={{
              border: '1px solid #ddd',
              borderRadius: 8,
              padding: 16,
            }}
          >
            <h2>{p.title}</h2>
            {p.brand && <p>Бренд: {p.brand}</p>}
            <p>Цена: £{p.price.toFixed(2)}</p>
            <p>Скидка: {p.discount_percent}%</p>
            <p>Кэшбэк: {p.cashback_percent}%</p>
            {p.seller && (
              <p>
                Продавец: {p.seller.name}{' '}
                {p.seller.rating && `(рейтинг ${p.seller.rating.rating})`}
              </p>
            )}
            {p.best_offer_score !== undefined && (
              <p>Индекс выгоды: {p.best_offer_score}</p>
            )}

            <BestOfferBars product={p} />

            {p.best_offer_reason && (
              <ul>
                {p.best_offer_reason.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
