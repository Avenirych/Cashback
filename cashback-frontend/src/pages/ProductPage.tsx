import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

export default function ProductPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);

  useEffect(() => {
    fetch(`http://localhost:3000/products/${id}`)
      .then(r => r.json())
      .then(setProduct);
  }, [id]);

  if (!product) return <p>Загрузка...</p>;

  return (
    <div>
      <h1>{product.name}</h1>
      <p>Категория: {product.category}</p>

      <h2>Предложения</h2>
      {product.offers.map(o => (
        <div key={o.id}>
          <p>Цена: {o.price}</p>
          <p>Кэшбэк: {o.cashback}</p>
          <p>Продавец: {o.seller.name}</p>
        </div>
      ))}
    </div>
  );
}
