import { useState } from "react";

export default function Compare() {
  const [ids, setIds] = useState("");
  const [offers, setOffers] = useState([]);

  const compare = () => {
    fetch(`http://localhost:3000/products/compare?ids=${ids}`)
      .then(r => r.json())
      .then(setOffers);
  };

  return (
    <div>
      <h1>Сравнение товаров</h1>

      <input
        value={ids}
        onChange={e => setIds(e.target.value)}
        placeholder="Введите ID через запятую"
      />
      <button onClick={compare}>Сравнить</button>

      {offers.map(o => (
        <div key={o.id}>
          <h3>{o.product.name}</h3>
          <p>Цена: {o.price}</p>
          <p>Кэшбэк: {o.cashback}</p>
        </div>
      ))}
    </div>
  );
}
