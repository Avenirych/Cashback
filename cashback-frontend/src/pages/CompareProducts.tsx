import React, { useState } from 'react';
import { fetchJson } from '../api';

interface CompareResponse {
  product1: any;
  product2: any;
  comparison: {
    rating_winner: 1 | 2;
    discount_winner: 1 | 2;
    cashback_winner: 1 | 2;
    price_winner: 1 | 2;
    best_offer_winner: 1 | 2;
  } | null;
  table?: any;
}

export const CompareProducts: React.FC = () => {
  const [id1, setId1] = useState('');
  const [id2, setId2] = useState('');
  const [data, setData] = useState<CompareResponse | null>(null);

  const handleCompare = async () => {
    const res = await fetchJson<CompareResponse>(
      `/products/compare?id1=${id1}&id2=${id2}`,
    );
    setData(res);
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>Сравнение товаров</h1>

      <div style={{ marginBottom: 16 }}>
        <input
          placeholder="ID товара 1"
          value={id1}
          onChange={(e) => setId1(e.target.value)}
        />
        <input
          placeholder="ID товара 2"
          value={id2}
          onChange={(e) => setId2(e.target.value)}
          style={{ marginLeft: 8 }}
        />
        <button onClick={handleCompare} style={{ marginLeft: 8 }}>
          Сравнить
        </button>
      </div>

      {data && data.table && (
        <table border={1} cellPadding={8}>
          <thead>
            <tr>
              <th>Параметр</th>
              <th>Товар 1</th>
              <th>Товар 2</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Рейтинг</td>
              <td>{data.table.rating.p1}</td>
              <td>{data.table.rating.p2}</td>
            </tr>
            <tr>
              <td>Скидка</td>
              <td>{data.table.discount.p1}%</td>
              <td>{data.table.discount.p2}%</td>
            </tr>
            <tr>
              <td>Кэшбэк</td>
              <td>{data.table.cashback.p1}%</td>
              <td>{data.table.cashback.p2}%</td>
            </tr>
            <tr>
              <td>Цена</td>
              <td>£{data.table.price.p1}</td>
              <td>£{data.table.price.p2}</td>
            </tr>
            <tr>
              <td>Индекс выгоды</td>
              <td>{data.table.best_offer_score.p1}</td>
              <td>{data.table.best_offer_score.p2}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
};
