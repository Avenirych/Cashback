import {Link} from 'react-router-dom';
import {useLang} from '../context/LanguageContext';
const copy={
 ru:['Демонстрационный режим','Регистрация, публикация отзывов и модерация пока закрыты. Они станут доступны после настройки владельца и защиты доступа.','На главную'],
 en:['Demonstration mode','Registration, review submissions and moderation are currently closed. They will become available after owner setup and access protection.','Home'],
 de:['Demonstrationsmodus','Registrierung, das Einreichen von Bewertungen und die Moderation sind derzeit geschlossen. Sie werden nach der Einrichtung des Eigentümerkontos und des Zugriffsschutzes verfügbar.','Startseite'],
 fr:['Mode démonstration','L’inscription, l’envoi d’avis et la modération sont actuellement fermés. Ils seront disponibles après la configuration du compte propriétaire et de la protection des accès.','Accueil'],
};
export default function DemoClosed(){const {lang}=useLang();const t=copy[lang as keyof typeof copy];if(!t)return null;return <main style={{maxWidth:800,margin:'auto',padding:24}} lang={lang}><h1>{t[0]}</h1><p>{t[1]}</p><Link to="/">{t[2]}</Link></main>;}
