import {canReadBonusSnapshot,localBonusReadOnly} from '../bonusReadOnly';
import {Link} from "react-router-dom";
import {useAuth} from "../context/AuthContext";
import {useBonuses} from "../context/BonusesContext";
import type {BonusItem} from "../bonus.types";
import content from "../content/dashboard.json";
import "./Dashboard.css";

export function sourceTotal(items:BonusItem[],source:string):number|null {
 const rows=items.filter(r=>r.source===source&&r.status==="confirmed");
 if(rows.some(r=>typeof r.isExpired!=="boolean"||!Number.isFinite(r.amount)))return null;
 return rows.filter(r=>r.isExpired===false).reduce((n,r)=>n+Math.round(r.amount*100),0)/100;
}
function Table({headers,children}:{headers:string[];children:React.ReactNode}) {
 return <div className="table-wrap" tabIndex={0} role="region" aria-label={headers.join(" · ")}><table className="dash-table">
 <thead><tr>{headers.map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}
export default function Dashboard({lang}:{lang:string}) {
 const key=lang.toLowerCase() as keyof typeof content,t=content[key]||content.en;
 const {user}=useAuth(),{summary,items,loading,error,refresh}=useBonuses();
 const isolated=!canReadBonusSnapshot(),authenticated=!!user?.email_verified;
 const available=authenticated&&!isolated&&!loading&&!error&&summary!==null&&items.every(r=>r&&r.userId===user?.id);
 const ownItems=items.filter(r=>r&&r.userId===user?.id);
 const safeItems=ownItems.filter(r=>r&&typeof r.id==="string");
 const number=(v:unknown)=>typeof v==="number"&&Number.isFinite(v)?new Intl.NumberFormat(lang,{maximumSignificantDigits:21}).format(v):t.unavailable;
 const date=(v:unknown)=>typeof v==="string"&&Number.isFinite(Date.parse(v))?new Intl.DateTimeFormat(lang,{dateStyle:"short",timeStyle:"short",timeZone:"UTC"}).format(new Date(v)):t.unavailable;
 const source=(r:BonusItem)=>({ads:t.ads,research:t.research,transfer:t.transfer,purchase:t.purchase,refund:t.refund}[r.source]||t.unavailable);
 const status=(r:BonusItem)=>r.isExpired&&(r.status==="confirmed"||r.status==="pending")?t.statuses.expired:t.statuses[r.status]||t.unavailable;
 const absent=loading&&!isolated?t.loading:t.unavailable;
 const emptyRow=(columns:number,message:string)=><tr><td colSpan={columns}>{message}</td></tr>;
 const bonusTable=(rows:BonusItem[],used=false,amountTitle=t.amount)=><Table headers={[used?t.usedAt:t.date+" (UTC)",t.source,amountTitle,t.status,t.expiry,...(used?[t.reference]:[])]}>
 {!available?emptyRow(used?6:5,absent):!rows.length?emptyRow(used?6:5,t.empty):rows.map(r=><tr key={r.id}>
 <td>{date(used?r.usedAt:r.createdAt)}</td><td>{source(r)}</td><td>{number(r.amount)} {t.unit}</td><td>{status(r)}</td><td>{date(r.expiresAt)}</td>{used&&<td>{r.orderId||r.referenceId||t.unavailable}</td>}
 </tr>)}</Table>;
 const section=(id:string,title:string,children:React.ReactNode)=><section className="section-block" id={id} aria-labelledby={id+"-title"}><h2 id={id+"-title"}>{title}</h2>{children}</section>;
 const bonusSection=(kind:"ads"|"research")=>{
 const rows=safeItems.filter(r=>r.source===kind),confirmed=rows.filter(r=>r.status==="confirmed"&&r.isExpired===false),pending=rows.filter(r=>r.status==="pending"&&r.isExpired===false),other=rows.filter(r=>!confirmed.includes(r)&&!pending.includes(r));
 return section("dashboard-"+kind,t[kind],<>{kind==="research"&&<p>{t.researchMetadataUnavailable}</p>}<p>{t.expiryNote}</p>
 <details><summary>{t.confirmed}</summary><p>{t.confirmedNote}</p>{bonusTable(confirmed,false,t.confirmedReward)}</details>
 <details><summary>{t.pending}</summary><p>{t.pendingNote}</p>{bonusTable(pending,false,t.expectedReward)}</details>
 <details><summary>{t.other}</summary>{bonusTable(other)}</details></>);
 };
 const metrics:[string,number|null|undefined][]=[
 [t.adConfirmed,available?sourceTotal(safeItems,"ads"):null],
 [t.researchConfirmed,available?sourceTotal(safeItems,"research"):null],
 [t.totalConfirmed,available?summary?.confirmed:null],
 [t.available,available?summary?.available:null],
 [t.usedTotal,available?summary?.spent:null]];
 return <main className="dashboard-page"><div className="dashboard-container">
 <h1 className="dashboard-title">{t.title}</h1>
 {section("dashboard-info",t.important,t.info.map(text=><p key={text}>{text}</p>))}
 {section("dashboard-summary",t.summary,<><div className="summary-grid">{metrics.map(([label,value])=><div className="sum-card" key={label}><p>{label}</p><strong>{number(value)}</strong>{typeof value==="number"&&Number.isFinite(value)&&<span> {t.unit}</span>}</div>)}</div>
 {localBonusReadOnly()&&<p role="note">{t.readOnly}</p>}
 {isolated?<p role="status">{t.isolated}</p>:!authenticated?<p>{t.guest} <Link to="/login">{t.login}</Link></p>:loading?<p role="status">{t.loading}</p>:error?<p role="alert">{t.error}</p>:null}
 {authenticated&&!isolated&&<button type="button" disabled={loading} onClick={()=>{void refresh().catch(()=>{});}}>{t.refresh}</button>}
 {available&&<p>{t.updated}: {date(summary?.lastUpdated)}</p>}</>)}
 {section("dashboard-purchases",t.purchases,<><p>{t.purchaseNote}</p><Table headers={[t.date,t.product,t.cashback,t.status,t.estimate]}>{emptyRow(5,t.purchaseUnavailable)}</Table></>)}
 {bonusSection("ads")}{bonusSection("research")}
 {section("dashboard-used",t.used,<><p>{t.usedNote}</p>{bonusTable(safeItems.filter(r=>r.status==="spent"),true)}</>)}
 {section("dashboard-payouts",t.payouts,<><p>{t.payoutNote}</p><Table headers={[t.date,t.moneyAmount,t.currency,t.basis,t.operationStatus]}>{emptyRow(5,t.payoutUnavailable)}</Table></>)}
 {section("dashboard-links",t.links,<nav aria-label={t.links}>{[[t.rules,"/activity-limits"],[t.terms,"/terms"],[t.privacy,"/privacy"],[t.support,"/contacts"],[t.appeal,"/my-activity#my-activity-restrictions"]].map(([label,to])=><Link key={to} to={to}>{label}</Link>)}</nav>)}
 </div></main>;
}
