import {getResearchMessages} from './researchData';

// Presentation only: never changes the stored study value.
export function formatResearchBonus(value: number | {min: number; max: number}, lang: string): string {
  const t = getResearchMessages(lang);
  const min = typeof value === 'number' ? value : value.min;
  const max = typeof value === 'number' ? value : value.max;
  const key = lang.toUpperCase();
  // The Russian prepositions «до» and «от … до» require the genitive case.
  const noun = key === 'RU' ? (max % 10 === 1 && max % 100 !== 11 ? 'бонуса' : 'бонусов')
    : key === 'DE' ? (max === 1 ? 'Bonus' : 'Boni')
    : key === 'FR' ? 'bonus' : (max === 1 ? 'bonus' : 'bonuses');
  const amount = `${max} ${noun}`;
  return (min === max ? t.upTo : t.rewardRange).replace('{min}', String(min)).replace('{amount}', amount);
}
