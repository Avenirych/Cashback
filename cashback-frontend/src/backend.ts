import {locale,words} from './content/siteContent';
function unavailableMessage(){let lang='en';try{lang=localStorage.getItem('lang')||'en';}catch{}return words('The service is temporarily unavailable. Please try again later.','Сервис временно недоступен. Попробуйте позже.','Der Dienst ist vorübergehend nicht verfügbar. Bitte versuchen Sie es später erneut.','Le service est temporairement indisponible. Veuillez réessayer plus tard.')[locale(lang)];}
/** Shared historical backend origin; configuration only. */
export const BACKEND_URL = (process.env.REACT_APP_API_BASE || 'http://localhost:3001').replace(/\/+$/, '');

export async function backendFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  init.signal?.addEventListener('abort', cancel);
  if (init.signal?.aborted) cancel();
  const timer = setTimeout(cancel, 10000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (response.status >= 500 && /\/auth\//.test(url)) {
      throw new Error(unavailableMessage());
    }
    return response;
  } catch (error) {
    if (init.signal?.aborted) throw error;
    if (error instanceof TypeError || controller.signal.aborted) {
      throw new Error(unavailableMessage());
    }
    throw error;
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener('abort', cancel);
  }
}
