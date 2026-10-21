import { getCountries } from 'libphonenumber-js';
import type { CountryCode } from 'libphonenumber-js';
export const DRAFT_KEY='cashback_registration_draft_v1';
export interface Draft { firstName:string; lastName:string; email:string; phone:string; country:CountryCode }
const empty:Draft={firstName:'',lastName:'',email:'',phone:'',country:'GB'};
export function readDraft():Draft { try {const v=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null');if(!v||typeof v!=='object')return {...empty};return {firstName:typeof v.firstName==='string'?v.firstName.slice(0,100):'',lastName:typeof v.lastName==='string'?v.lastName.slice(0,100):'',email:typeof v.email==='string'?v.email.slice(0,320):'',phone:typeof v.phone==='string'?v.phone.slice(0,64):'',country:getCountries().includes(v.country)?v.country:'GB'};}catch{return {...empty};} }
export function saveDraft(v:Draft) { try {localStorage.setItem(DRAFT_KEY,JSON.stringify({firstName:v.firstName,lastName:v.lastName,email:v.email,phone:v.phone,country:v.country}));}catch{} }
export function clearDraft(){try{localStorage.removeItem(DRAFT_KEY);}catch{}}
export function passwordChecks(v:string){return [v.length>=8,/[A-Z]/.test(v),/[a-z]/.test(v),/\d/.test(v),/[^A-Za-z0-9]/.test(v)];}
