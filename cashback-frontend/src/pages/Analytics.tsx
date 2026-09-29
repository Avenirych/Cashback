import { useEffect, useState } from "react";

export default function Analytics() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch("http://localhost:3000/analytics")
      .then(r => r.json())
      .then(setStats);
  }, []);

  if (!stats) return <p>Загрузка...</p>;

  return (
    <div>
      <h1>Аналитика</h1>
      <p>Кликов за сутки: {stats.clicksToday}</p>
      <p>Транзакций за сутки: {stats.transactionsToday}</p>
      <p>Лучший продавец: {stats.bestSeller}</p>
    </div>
  );
}
