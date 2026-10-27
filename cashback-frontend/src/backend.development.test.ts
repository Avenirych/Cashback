jest.mock('http-proxy-middleware', () => ({createProxyMiddleware: jest.fn(() => jest.fn())}));
const {createProxyMiddleware} = require('http-proxy-middleware');
const configure = require('./setupProxy');
const oldBase = process.env.REACT_APP_API_BASE;
beforeEach(() => createProxyMiddleware.mockImplementation(() => jest.fn()));
afterEach(() => { if (oldBase === undefined) delete process.env.REACT_APP_API_BASE; else process.env.REACT_APP_API_BASE=oldBase; jest.clearAllMocks(); });
function setup() { const app={use:jest.fn()}; configure(app); return {guard:app.use.mock.calls[0][1],prefix:app.use.mock.calls[0][0],proxy:createProxyMiddleware.mock.results[0].value}; }
test('development proxy uses a fixed local backend and removes only the API prefix', () => {
 const {prefix}=setup(); expect(prefix).toBe('/api');
 expect(createProxyMiddleware).toHaveBeenCalledWith(expect.objectContaining({target:'http://127.0.0.1:3006',pathRewrite:{'^/api':''},changeOrigin:true,logLevel:'silent'}));
});
test.each(['127.0.0.1:3005','localhost:3005'])('same-origin local requests are forwarded for %s', host => {
 const {guard,proxy}=setup(); const req={headers:{host,origin:`http://${host}`}},res={end:jest.fn()},next=jest.fn(); guard(req,res,next); expect(proxy).toHaveBeenCalledWith(req,res,next); expect(res.end).not.toHaveBeenCalled();
});
test.each([{host:'127.0.0.1:3005',origin:'https://untrusted.example'},{host:'remote.example:3005'},{host:''}])('foreign origin/host is rejected without forwarding %#', headers => {
 const {guard,proxy}=setup(); const res={statusCode:200,end:jest.fn()};guard({headers},res,jest.fn());expect(res.statusCode).toBe(403);expect(proxy).not.toHaveBeenCalled();
});
test('same-origin API configuration keeps registration under /api', () => {
 process.env.REACT_APP_API_BASE='/api'; jest.isolateModules(()=>{const {BACKEND_URL}=require('./backend');expect(BACKEND_URL).toBe('/api');for(const origin of ['http://127.0.0.1:3005','http://localhost:3005'])expect(new URL(`${BACKEND_URL}/auth/register`,origin).href).toBe(origin+'/api/auth/register');});
});
test('existing unconfigured and explicit API origins stay unchanged', () => {
 delete process.env.REACT_APP_API_BASE; jest.isolateModules(()=>expect(require('./backend').BACKEND_URL).toBe('http://localhost:3001'));
 process.env.REACT_APP_API_BASE='http://127.0.0.1:3006/';jest.isolateModules(()=>expect(require('./backend').BACKEND_URL).toBe('http://127.0.0.1:3006'));
});
export {};
