import {render,screen,within,fireEvent,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import Dashboard,{sourceTotal} from './Dashboard';
import copy from '../content/dashboard.json';
import type {BonusItem} from '../bonus.types';
let mockStore:any,mockUser:any,mockIsolated=false,mockReadOnly=false;
jest.mock('../context/BonusesContext',()=>({useBonuses:()=>mockStore}));
jest.mock('../context/AuthContext',()=>({useAuth:()=>({user:mockUser})}));
jest.mock('../registrationIsolation',()=>({registrationIsolated:()=>mockIsolated}));
jest.mock('../bonusReadOnly',()=>({canReadBonusSnapshot:()=>!mockIsolated||mockReadOnly,localBonusReadOnly:()=>mockReadOnly}));
const item=(id:string,source:BonusItem['source'],amount:number,status:BonusItem['status']='confirmed',isExpired=false):BonusItem=>({id,userId:42,source,amount,status,isExpired,createdAt:'2026-10-01T00:00:00Z',expiresAt:'2026-11-01T00:00:00Z',usedAt:status==='spent'?'2026-10-02T00:00:00Z':null,orderId:status==='spent'?'real-reference':null});
beforeEach(()=>{mockReadOnly=false;mockIsolated=false;mockUser={id:42,email_verified:true};mockStore={summary:{balance:28,confirmed:33,available:28,pending:7,spent:5,expired:100,lastUpdated:'2026-10-27T00:00:00Z'},items:[item('ads','ads',10),item('research','research',20),item('incoming','transfer',3),item('pending','research',7,'pending'),item('expired','research',100,'confirmed',true),item('spent','ads',5,'spent')],loading:false,error:null,refresh:jest.fn().mockResolvedValue(undefined)};});
function mount(lang='ru'){return render(<MemoryRouter><Dashboard lang={lang}/></MemoryRouter>);}
test.each(['ru','en','de','fr'] as const)('%s separates genuine bonus metrics from purchases and money',lang=>{
 const c=copy[lang],v=mount(lang);const summary=document.getElementById('dashboard-summary')!;
 expect(Array.from(summary.querySelectorAll('.sum-card strong'),e=>e.textContent)).toEqual(['10','20','33','28','5']);
 expect(summary.textContent).not.toMatch(/GBP|£/);for(const p of c.info)expect(screen.getByText(p)).toBeInTheDocument();
 expect(within(document.getElementById('dashboard-payouts')!).getByText(c.payoutUnavailable)).toBeInTheDocument();
 expect(within(document.getElementById('dashboard-purchases')!).getByText(c.purchaseUnavailable)).toBeInTheDocument();
 const research=document.getElementById('dashboard-research')!,groups=research.querySelectorAll('details');
 expect(within(groups[0]).getByText(c.confirmedNote)).toBeInTheDocument();expect(within(groups[1]).getByText(c.pendingNote)).toBeInTheDocument();
 fireEvent.click(groups[0].querySelector('summary')!);fireEvent.click(groups[1].querySelector('summary')!);expect(within(groups[0]).getByRole('columnheader',{name:c.confirmedReward})).toBeInTheDocument();expect(within(groups[1]).getByRole('columnheader',{name:c.expectedReward})).toBeInTheDocument();expect(screen.getByText(c.researchMetadataUnavailable)).toBeInTheDocument();expect(groups[0].textContent).toContain('20');expect(groups[0].textContent).not.toContain('100');
 expect(groups[1].textContent).toContain('7');expect(groups[2].textContent).toContain(c.statuses.expired);
 expect(research.textContent).toContain(c.expiryNote);expect(research.textContent).toContain(c.expiry);
 const used=document.getElementById('dashboard-used')!;expect(used.textContent).toContain('real-reference');expect(used.textContent).not.toContain('GBP');
 expect(Array.from(v.container.querySelectorAll('.dashboard-container > section'),e=>e.id)).toEqual(['dashboard-info','dashboard-summary','dashboard-purchases','dashboard-ads','dashboard-research','dashboard-used','dashboard-payouts','dashboard-links']);
 const links=within(document.getElementById('dashboard-links')!).getAllByRole('link');expect(links.map(e=>e.getAttribute('href'))).toEqual(['/activity-limits','/terms','/privacy','/contacts','/my-activity#my-activity-restrictions']);
});
test('missing snapshot never creates zero balances or invented history',()=>{mockStore.summary=null;mockStore.items=[];mount();expect(Array.from(document.querySelectorAll('.sum-card strong'),e=>e.textContent)).toEqual(Array(5).fill(copy.ru.unavailable));expect(screen.queryByText('0')).toBeNull();});
test('empty genuine snapshot shows real zeros and empty lists rather than unavailable',()=>{mockStore.summary={...mockStore.summary,confirmed:0,available:0,spent:0};mockStore.items=[];mount();expect(Array.from(document.querySelectorAll('.sum-card strong'),e=>e.textContent)).toEqual(Array(5).fill('0'));expect(within(document.getElementById('dashboard-used')!).getByText(copy.ru.empty)).toBeInTheDocument();});
test('API failures are localized, discard numeric display and allow safe refresh',async()=>{mockStore.error='Untranslated internal detail';mockStore.summary=null;mockStore.refresh.mockRejectedValue(new Error('offline'));mount('de');expect(screen.getByRole('alert')).toHaveTextContent(copy.de.error);expect(screen.queryByText('Untranslated internal detail')).toBeNull();fireEvent.click(screen.getByRole('button',{name:copy.de.refresh}));await waitFor(()=>expect(mockStore.refresh).toHaveBeenCalledTimes(1));});
test('loading, guest and isolated modes keep honest states without enabling finance',()=>{mockIsolated=true;mount();expect(screen.getByRole('status')).toHaveTextContent(copy.ru.isolated);expect(screen.queryByRole('button',{name:copy.ru.refresh})).toBeNull();expect(document.getElementById('dashboard-summary')!.textContent).not.toContain('33');});
test('loading and unauthenticated views do not reveal stale account amounts',()=>{mockStore.loading=true;const v=mount();expect(screen.getByRole('status')).toHaveTextContent(copy.ru.loading);expect(document.querySelector('.sum-card strong')).toHaveTextContent(copy.ru.unavailable);mockStore.loading=false;mockUser=null;v.rerender(<MemoryRouter><Dashboard lang="ru"/></MemoryRouter>);expect(screen.getByText(copy.ru.guest)).toBeInTheDocument();expect(screen.queryByRole('button',{name:copy.ru.refresh})).toBeNull();});
test('foreign account records never leak into the current dashboard',()=>{mockStore.items=[{...item('foreign','ads',900),userId:99}];mount();expect(document.querySelector('.sum-card strong')).toHaveTextContent(copy.ru.unavailable);expect(document.querySelector('.dashboard-page')!.textContent).not.toContain('900');});
test('source totals exclude expired and pending, and do not invent unknown expiry state',()=>{expect(sourceTotal(mockStore.items,'research')).toBe(20);expect(sourceTotal([{...item('x','ads',10),isExpired:undefined}],'ads')).toBeNull();});
test('language switching translates all content without changing data or calling mutations',()=>{const v=mount('en');fireEvent.click(screen.getByText(copy.en.confirmed,{selector:'#dashboard-research summary'}));v.rerender(<MemoryRouter><Dashboard lang="fr"/></MemoryRouter>);expect(screen.getByRole('heading',{name:copy.fr.title})).toBeInTheDocument();expect(document.querySelector('#dashboard-research details')).toHaveAttribute('open');expect(mockStore.refresh).not.toHaveBeenCalled();});

test.each(['ru','en','de','fr'] as const)('%s bonus display preserves fractional precision and ignores monetary currency hints',lang=>{
 const separator=lang==='en'?'.':',',expected='150'+separator+'123456789';
 mockStore.summary.available=150.123456789;mockStore.summary.currency='GBP';
 mockStore.items.push({...item('precise','research',150.123456789,'pending'),currency:'GBP'});
 mount(lang);
 expect(document.querySelectorAll('.sum-card strong')[3]).toHaveTextContent(expected);
 const pending=document.querySelectorAll('#dashboard-research details')[1];
 fireEvent.click(pending.querySelector('summary')!);
 expect(within(pending as HTMLElement).getByText(expected+' '+copy[lang].unit)).toBeInTheDocument();
 expect(document.querySelector('main.dashboard-page')!.textContent).not.toMatch(/GBP|£/);
 const payouts=document.getElementById('dashboard-payouts')!;
 expect(within(payouts).getByRole('columnheader',{name:copy[lang].currency})).toBeInTheDocument();
 expect(within(payouts).getByText(copy[lang].payoutUnavailable)).toBeInTheDocument();
});
test.each(['ru','en','de','fr'] as const)('%s very small bonus values do not become a fictitious zero',lang=>{
 mockStore.summary.available=0.000000123;
 mount(lang);expect(document.querySelectorAll('.sum-card strong')[3]).toHaveTextContent(lang==='en'?'0.000000123':'0,000000123');
});

test.each(['ru','en','de','fr'] as const)('%s reviewed read-only mode shows existing bonus data with an explicit local-context note',lang=>{mockIsolated=true;mockReadOnly=true;mount(lang);expect(screen.getByRole('note')).toHaveTextContent(copy[lang].readOnly);expect(document.querySelectorAll('.sum-card strong')[3]).toHaveTextContent('28');expect(screen.queryByText(copy[lang].isolated)).toBeNull();expect(document.querySelector('main')!.textContent).not.toMatch(/GBP|£/);});
