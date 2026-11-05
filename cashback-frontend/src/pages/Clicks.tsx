import { LEGACY_BACKEND_URL } from '../backend';
import { useEffect, useState } from "react";

export default function Clicks() {
  const [clicks, setClicks] = useState([]);

  useEffect(() => {
    fetch(`${LEGACY_BACKEND_URL}/clicks`)
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
