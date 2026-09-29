import { useEffect, useState } from "react";

export default function BestOffers() {
  const [offers, setOffers] = useState([]);

  useEffect(() => {
    fetch("http://localhost:3000/products/best")
      .then(r => r.json())
      .then(setOffers);
  }, []);

  return (
    <div>
      <h1>Лучшие предложения</h1>
      {offers.map(o => (
        <div key={o.id}>
          <h3>{o.product.name}</h3>
          <p>Цена: {o.price}</p>
          <p>Кэшбэк: {o.cashback}</p>
          <p>Продавец: {o.seller.name}</p>
        </div>
      ))}
    </div>
  );
}
