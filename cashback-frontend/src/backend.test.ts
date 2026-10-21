import { backendFetch } from './backend';

afterEach(() => jest.useRealTimers());

test('reports unavailable backend without exposing network diagnostics', async () => {
  global.fetch = jest.fn().mockRejectedValue(new TypeError('private connection details'));
  await expect(backendFetch('http://localhost:3001/auth/register')).rejects.toThrow('Cannot reach the backend');
});

test('reports backend/schema failures without returning server diagnostics', async () => {
  global.fetch = jest.fn().mockResolvedValue({ status: 500 });
  await expect(backendFetch('http://localhost:3001/auth/register')).rejects.toThrow('test database/schema is not ready');
});

test('preserves validation responses and request data', async () => {
  const response = { status: 400 };
  global.fetch = jest.fn().mockResolvedValue(response);
  await expect(backendFetch('http://localhost:3001/auth/register', {method: 'POST', body: 'synthetic'})).resolves.toBe(response);
  expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({method: 'POST', body: 'synthetic'}));
});

test('bounds session restoration when the server does not respond', async () => {
  jest.useFakeTimers();
  global.fetch = jest.fn().mockImplementation((_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }));
  const result = expect(backendFetch('http://localhost:3001/auth/profile')).rejects.toThrow('Cannot reach the backend');
  jest.advanceTimersByTime(10000);
  await result;
});
