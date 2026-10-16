/** Shared browser-to-Nest address; bonus-api remains a separate service. */
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
      throw new Error('Backend is unavailable or the approved test database/schema is not ready. / Backend или схема разрешённой тестовой БД не готовы.');
    }
    return response;
  } catch (error) {
    if (init.signal?.aborted) throw error;
    if (error instanceof TypeError || controller.signal.aborted) {
      throw new Error('Cannot reach the backend. Check the approved local backend and test database. / Backend недоступен: проверьте разрешённое локальное окружение.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener('abort', cancel);
  }
}
