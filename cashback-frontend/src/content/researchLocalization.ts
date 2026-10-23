import {labels,locale,words,sections} from './siteContent';
import type {ResearchDirection,DirectionText} from '../researchData';
const titles:Record<string,[string,string]>={surveys:['Umfragen','Enquêtes'],'focus-groups':['Fokusgruppen','Groupes de discussion'],ux:['Nutzungstests','Tests d’utilisation'],'mystery-shopping':['Testkäufe','Visites mystères'],health:['Gesundheitsstudien','Études de santé'],b2b:['Fachliche Interviews','Entretiens professionnels'],diaries:['Tagebuchstudien','Études avec journal'],communities:['Forschungsgemeinschaften','Communautés d’étude'],academic:['Akademische Studien','Études universitaires'],experts:['Experteninterviews','Entretiens d’experts']};
const summaries:Record<string,[string,string]>={
 surveys:['Fragen zu Einkäufen, Gewohnheiten und Präferenzen.','Questions sur les achats, habitudes et préférences.'],
 'focus-groups':['Moderierte Gespräche über Produkte und Ideen.','Discussions animées sur des produits et idées.'],
 ux:['Rückmeldungen zur Bedienung von Websites und Produkten.','Retours sur l’utilisation de sites et produits.'],
 'mystery-shopping':['Beobachtungen zur Qualität einer Dienstleistung.','Observations sur la qualité d’un service.'],
 health:['Gesundheitsforschung mit besonderen Teilnahmebedingungen.','Recherches en santé avec critères spécifiques.'],
 b2b:['Erfahrungen aus beruflichen Kauf- und Arbeitsprozessen.','Expériences des achats et processus professionnels.'],
 diaries:['Wiederkehrende Aufzeichnungen über Erfahrungen im Alltag.','Notes régulières sur des expériences quotidiennes.'],
 communities:['Längerfristiger Austausch zu ausgewählten Themen.','Échanges suivis sur des thèmes sélectionnés.'],
 academic:['Wissenschaftliche Fragestellungen unter Studienbedingungen.','Questions scientifiques selon un protocole d’étude.'],
 experts:['Fachwissen zu spezialisierten Fragestellungen.','Expertise sur des questions spécialisées.'],
};
export function directionText(direction:ResearchDirection,lang:string):DirectionText{
 const l=locale(lang);if(l==='ru')return direction.ru;if(l==='en')return {...direction.en,title:direction.en.title.replace('Paid Surveys','Surveys')};
 return {title:titles[direction.id]?.[l==='de'?0:1]||labels.bonuses[l],summary:summaries[direction.id]?.[l==='de'?0:1]||sections.activities.body[l],
 goals:words('Improve products and services.','Улучшить продукты и услуги.','Produkte und Dienstleistungen verbessern.','Améliorer produits et services.')[l],
 participants:words('Participants meeting the study criteria.','Участники, соответствующие критериям исследования.','Teilnehmer, die die Studienkriterien erfüllen.','Participants répondant aux critères de l’étude.')[l],
 conditions:words('Read eligibility, privacy and confirmation conditions before participation.','До участия изучите допуск, сведения о данных и условия подтверждения.','Vor der Teilnahme Eignung, Datenschutz und Bestätigungsbedingungen prüfen.','Consulter l’éligibilité, la confidentialité et la confirmation avant de participer.')[l]};
}
export function researchMessages(lang:string){const l=locale(lang);return {
 title:words('Research','Исследования','Studien','Études')[l],subtitle:labels.description[l],demo:labels.demo[l],goals:words('Goals','Цели','Ziele','Objectifs')[l],participants:words('Participants','Участники','Teilnehmer','Participants')[l],conditions:labels.rewardTerms[l],expected:labels.rewardTerms[l],bonusRange:labels.money[l],studyCount:words('Studies','Исследования','Studien','Études')[l],start:words('Explore demonstration','Посмотреть демонстрацию','Demonstration ansehen','Voir la démonstration')[l],participate:words('Explore category','Посмотреть направление','Kategorie ansehen','Voir la catégorie')[l],back:words('Back','Назад','Zurück','Retour')[l],notFound:words('Category not found','Направление не найдено','Kategorie nicht gefunden','Catégorie introuvable')[l],studyName:(id:number)=>words('Demonstration study','Демонстрационное исследование','Demonstrationsstudie','Étude de démonstration')[l]+' '+id,empty:words('No studies available','Нет доступных исследований','Keine Studien verfügbar','Aucune étude disponible')[l],offerTitle:words('Study','Исследование','Studie','Étude')[l],bonusUnit:words('demo units','демо-единиц','Demo-Einheiten','unités de démonstration')[l]};}
