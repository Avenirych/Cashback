import { useEffect, useState } from "react";

export default function Partners() {
  const [partners, setPartners] = useState([]);

  useEffect(() => {
    fetch("http://localhost:3000/partners")
      .then(r => r.json())
      .then(setPartners);
  }, []);

  return (
    <div>
      <h1>Партнёры</h1>
      {partners.map(s => (
        <div key={s.id}>
          <h3>{s.name}</h3>
          <p>Рейтинг: {s.rating}</p>
        </div>
      ))}
    </div>
  );
}
