import { useEffect, useState } from "react";

export default function Catalog() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    fetch("http://localhost:3000/products")
      .then(r => r.json())
      .then(setProducts);
  }, []);

  return (
    <div>
      <h1>Каталог товаров</h1>
      {products.map(p => (
        <div key={p.id}>
          <h3>{p.name}</h3>
          <p>Категория: {p.category}</p>
        </div>
      ))}
    </div>
  );
}
