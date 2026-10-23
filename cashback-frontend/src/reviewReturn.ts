const KEY='cashback_demo_review_intent';
export function rememberReviewIntent(){try{localStorage.setItem(KEY,JSON.stringify({path:'/forum/reviews/new',at:Date.now()}));}catch{}}
export function reviewIntent(){try{const r=JSON.parse(localStorage.getItem(KEY)||'null');return r?.path==='/forum/reviews/new'&&typeof r.at==='number'&&Date.now()-r.at>=0&&Date.now()-r.at<3600000?'/forum/reviews/new':null;}catch{return null;}}
export function clearReviewIntent(){try{localStorage.removeItem(KEY);}catch{}}
