/** Server-side opt-in bounded to the existing local historical installation. */
export function localDemoReviewsEnabled(env:NodeJS.ProcessEnv=process.env){
 return env.CASHBACK_LOCAL_DEMO_REVIEWS==='true'&&env.HISTORICAL_LOCAL==='true'&&env.HISTORICAL_CONTAINER==='true'
  &&env.FRONTEND_URL==='http://localhost:3004'&&env.DB_NAME==='cashback_historical_03573b7'
  &&env.CASHBACK_FORUM_READ_ONLY==='true'&&env.CASHBACK_PUBLIC_CONTENT==='false'&&env.CASHBACK_CONTENT_MODERATION==='false';
}
