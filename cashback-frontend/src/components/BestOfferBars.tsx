import React from 'react';
import { Product } from '../types';
import './BestOfferBars.css';

interface Props {
  product: Product;
}

export const BestOfferBars: React.FC<Props> = ({ product }) => {
  const v = product.best_offer_visual;
  if (!v) return null;

  return (
    <div className="best-offer-bars">
      <div className="bar-row">
        <span>Рейтинг продавца</span>
        <div className="bar">
          <div
            className="bar-fill"
            style={{
              width: `${v.rating_bar}%`,
              backgroundColor: v.rating_color,
              animationDelay: `${v.animation_delay}s`,
              animationDuration: `${v.animation_duration}s`,
            }}
          />
        </div>
      </div>

      <div className="bar-row">
        <span>Скидка</span>
        <div className="bar">
          <div
            className="bar-fill"
            style={{
              width: `${v.discount_bar}%`,
              backgroundColor: v.discount_color,
              animationDelay: `${v.animation_delay + 0.1}s`,
              animationDuration: `${v.animation_duration}s`,
            }}
          />
        </div>
      </div>

      <div className="bar-row">
        <span>Кэшбэк</span>
        <div className="bar">
          <div
            className="bar-fill"
            style={{
              width: `${v.cashback_bar}%`,
              backgroundColor: v.cashback_color,
              animationDelay: `${v.animation_delay + 0.2}s`,
              animationDuration: `${v.animation_duration}s`,
            }}
          />
        </div>
      </div>

      <div className="bar-row">
        <span>Цена (штраф)</span>
        <div className="bar">
          <div
            className="bar-fill"
            style={{
              width: `${v.price_bar}%`,
              backgroundColor: v.price_color,
              animationDelay: `${v.animation_delay + 0.3}s`,
              animationDuration: `${v.animation_duration}s`,
            }}
          />
        </div>
      </div>
    </div>
  );
};
