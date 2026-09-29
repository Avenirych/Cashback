import { Link, useLocation } from "react-router-dom";
import { useContext, useState } from "react";
import { ThemeContext } from "../theme/ThemeContext";
import "./Menu.css";

import HomeIcon from "@mui/icons-material/Home";
import StarIcon from "@mui/icons-material/Star";
import StoreIcon from "@mui/icons-material/Store";
import SearchIcon from "@mui/icons-material/Search";
import CompareIcon from "@mui/icons-material/Compare";
import PeopleIcon from "@mui/icons-material/People";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import MouseIcon from "@mui/icons-material/Mouse";
import ReceiptIcon from "@mui/icons-material/Receipt";
import InsightsIcon from "@mui/icons-material/Insights";
import PersonIcon from "@mui/icons-material/Person";
import MenuIcon from "@mui/icons-material/Menu";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";

export default function Menu() {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const items = [
    { to: "/", label: "Главная", icon: <HomeIcon /> },
    { to: "/best", label: "Лучшие предложения", icon: <StarIcon /> },
    { to: "/catalog", label: "Каталог", icon: <StoreIcon /> },
    { to: "/search", label: "Поиск", icon: <SearchIcon /> },
    { to: "/compare", label: "Сравнение", icon: <CompareIcon /> },
    { divider: true },
    { to: "/partners", label: "Партнёры", icon: <PeopleIcon /> },
    { to: "/offers", label: "Все предложения", icon: <LocalOfferIcon /> },
    { to: "/clicks", label: "Клики", icon: <MouseIcon /> },
    { to: "/transactions", label: "Транзакции", icon: <ReceiptIcon /> },
    { divider: true },
    { to: "/analytics", label: "Аналитика", icon: <InsightsIcon /> },
    { to: "/profile", label: "Профиль", icon: <PersonIcon /> },
  ];

  return (
    <div className={`menu fade-in ${collapsed ? "collapsed" : ""}`}>
      <div className="menu-header">
        <div className="logo">💳 Cashback+</div>

        <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)}>
          <MenuIcon />
        </button>

        <button className="theme-btn" onClick={toggleTheme}>
          {theme === "light" ? <DarkModeIcon /> : <LightModeIcon />}
        </button>
      </div>

      <div className="menu-items">
        {items.map((item, i) =>
          item.divider ? (
            <hr key={i} />
          ) : (
            <Link
              key={item.to}
              className={`menu-item ${
                location.pathname === item.to ? "active" : ""
              }`}
              to={item.to}
            >
              {item.icon}
              {!collapsed && item.label}
            </Link>
          )
        )}
      </div>
    </div>
  );
}
