import { useEffect, useState } from "react";

export default function Clicks() {
  const [clicks, setClicks] = useState([]);

  useEffect(() => {
    fetch("http://localhost:3000/clicks")
      .then(r => r.json())
      .then(setClicks);
  }, []);

  return (
    <div>
      <h1>Клики</h1>
      {clicks.map(c => (
        <div key={c.id}>
          <p>Дата: {c.timestamp}</p>
          <p>Продавец: {c.seller.name}</p>
        </div>
      ))}
    </div>
  );
}
