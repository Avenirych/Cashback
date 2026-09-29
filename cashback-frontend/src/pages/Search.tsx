import { useState } from "react";

export default function Search() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  const search = () => {
    fetch(`http://localhost:3000/search?query=${query}`)
      .then(r => r.json())
      .then(setResults);
  };

  return (
    <div>
      <h1>Поиск товаров</h1>

      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Введите запрос"
      />
      <button onClick={search}>Искать</button>

      {results.map(p => (
        <div key={p.id}>
          <h3>{p.name}</h3>
          <p>Категория: {p.category}</p>
        </div>
      ))}
    </div>
  );
}
