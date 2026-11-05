import { LEGACY_BACKEND_URL } from '../backend';
import { useEffect, useState } from "react";

export default function Transactions() {
  const [tx, setTx] = useState([]);

  useEffect(() => {
    fetch(`${LEGACY_BACKEND_URL}/transactions`)
      .then(r => r.json())
      .then(setTx);
  }, []);

  return (
    <div>
      <h1>Транзакции</h1>
      {tx.map(t => (
        <div key={t.id}>
          <p>Сумма: {t.amount}</p>
          <p>Продавец: {t.seller.name}</p>
        </div>
      ))}
    </div>
  );
}
