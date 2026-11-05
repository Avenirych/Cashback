import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ForumGuard from "../components/ForumGuard";
import { LanguageProvider } from "./LanguageContext";

const mainUser = { id: 42, email: "private@example.com", name: "Private Name", email_verified: true };
const profile = {
  id: 7, user_id: 42, username: "ForumUser", avatar_url: null, created_at: "2026-01-01",
  agreed_to_rules: true, agreed_to_rules_at: "2026-01-01", updated_at: "2026-01-01", banned: false,
};
function response(data: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => data, text: async () => JSON.stringify(data) };
}
let auth: ReturnType<typeof useAuth>;
function Probe() {
  auth = useAuth();
  return <><span data-testid="main">{auth.user?.id || "none"}:{auth.token || "none"}</span>
    <span data-testid="forum">{auth.forumSessionActive ? "active" : "inactive"}:{auth.forumUser?.username || "none"}:{auth.forumLoading ? "loading" : "ready"}</span>
    <button onClick={auth.logoutFromForum}>exit</button><button onClick={auth.logout}>logout</button>
  </>;
}
function mount() { return render(<AuthProvider><Probe /></AuthProvider>); }
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  localStorage.setItem("cashback_token", "main-token");
  global.fetch = jest.fn(async (url) => {
    if (String(url).endsWith("/auth/logout-all")) return response(null, 204);
    if (String(url).endsWith("/auth/profile")) return response(mainUser);
    if (String(url).endsWith("/forum/status")) return response({ registered: true, forumUser: profile });
    throw new Error(`Unexpected request ${url}`);
  }) as jest.Mock;
});

test("forum exit leaves main session intact and survives refresh; existing membership can reenter", async () => {
  const { unmount } = mount();
  await screen.findByText("active:ForumUser:ready");
  fireEvent.click(screen.getByText("exit"));
  expect(auth.forumUser).toBeNull();
  expect(screen.getByTestId("main")).toHaveTextContent("42:main-token");
  expect(localStorage.getItem("cashback_token")).toBe("main-token");
  expect(sessionStorage.getItem("cashback_forum_exited:42")).toBe("1");
  unmount(); mount();
  await screen.findByText("42:main-token");
  await screen.findByText("inactive:none:ready");
  expect(auth.forumRegistered).toBe(true);
  await act(async () => { await auth.checkForumStatus(); });
  expect(auth.forumUser).toBeNull();
  expect(auth.forumSessionActive).toBe(false);
  await act(async () => { await auth.checkForumStatus(true); });
  expect(screen.getByTestId("forum")).toHaveTextContent("active:ForumUser:ready");
  expect(sessionStorage.getItem("cashback_forum_exited:42")).toBeNull();
  expect((fetch as jest.Mock).mock.calls.some(([url]) => String(url).endsWith("/forum/register"))).toBe(false);
});

test("forum exit marker is scoped to the main user", async () => {
  sessionStorage.setItem("cashback_forum_exited:99", "1");
  mount(); await screen.findByText("active:ForumUser:ready");
});

test("forum context actions retain stable identities across session updates", async () => {
  mount();
  await screen.findByText("active:ForumUser:ready");
  const actions = [auth.registerForum, auth.logoutFromForum, auth.checkForumStatus];
  fireEvent.click(screen.getByText("exit"));
  expect([auth.registerForum, auth.logoutFromForum, auth.checkForumStatus]).toEqual(actions);
  await act(async () => { await auth.checkForumStatus(true); });
  expect([auth.registerForum, auth.logoutFromForum, auth.checkForumStatus]).toEqual(actions);
});
test("strict guard waits for saved membership restoration instead of redirecting early", async () => {
  render(<AuthProvider><MemoryRouter initialEntries={["/protected"]}><Routes>
    <Route element={<ForumGuard />}><Route path="/protected" element={<p>Restored member content</p>} /></Route>
    <Route path="/forum/register" element={<p>Unexpected registration redirect</p>} />
  </Routes></MemoryRouter></AuthProvider>);
  await screen.findByText("Restored member content");
  expect(screen.queryByText("Unexpected registration redirect")).not.toBeInTheDocument();
});
test("stale status response cannot reactivate forum after exit", async () => {
  let finish!: (data: unknown) => void;
  const deferred = new Promise(resolve => { finish = resolve; });
  (fetch as jest.Mock).mockImplementation(async (url) =>
    String(url).endsWith("/auth/profile") ? response(mainUser) : deferred);
  mount(); await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  fireEvent.click(screen.getByText("exit"));
  await act(async () => { finish(response({ registered: true, forumUser: profile })); });
  expect(screen.getByTestId("forum")).toHaveTextContent("inactive:none:ready");
});

test("stale status response is ignored after main logout", async () => {
  let finish!: (data: unknown) => void;
  (fetch as jest.Mock).mockImplementation(async (url) =>
    String(url).endsWith("/auth/profile") ? response(mainUser) : String(url).endsWith("/auth/logout-all") ? response(null,204) : new Promise(resolve => { finish = resolve; }));
  mount(); await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  fireEvent.click(screen.getByText("logout"));
  await act(async () => { finish(response({ registered: true, forumUser: profile })); });
  expect(screen.getByTestId("main")).toHaveTextContent("none:none");
  expect(screen.getByTestId("forum")).toHaveTextContent("inactive:none:ready");
});

test("stale main session restore cannot undo logout", async () => {
  let finish!: (data: unknown) => void;
  (fetch as jest.Mock).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  mount();
  fireEvent.click(screen.getByText("logout"));
  await act(async () => { finish(response(mainUser)); });
  expect(auth.user).toBeNull();
  expect(auth.token).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("temporary unverified registration remains in memory and does not restore forum", async () => {
  localStorage.clear();
  (fetch as jest.Mock).mockResolvedValue(response({ access_token: "temporary", user: { ...mainUser, email_verified: false } }));
  mount();
  await act(async () => { await auth.register({ email: mainUser.email, name: mainUser.name, password: "example-password" }); });
  expect(auth.user?.id).toBe(42);
  expect(auth.token).toBe("temporary");
  expect(auth.isEmailVerificationPending).toBe(true);
  expect(localStorage.getItem("cashback_token")).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("unverified login uses a temporary session without checking forum", async () => {
  localStorage.clear();
  (fetch as jest.Mock).mockResolvedValue(response({ access_token: "temporary", user: { ...mainUser, email_verified: false } }));
  mount();
  await act(async () => { await auth.login({ email: mainUser.email, password: "example-password" }); });
  expect(auth.token).toBe("temporary");
  expect(localStorage.getItem("cashback_token")).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("failed avatar upload keeps registration and retry never registers twice", async () => {
  let avatarAttempts = 0;
  (fetch as jest.Mock).mockImplementation(async (url) => {
    if (String(url).endsWith("/auth/profile")) return response(mainUser);
    if (String(url).endsWith("/forum/status")) return response({ registered: false, forumUser: null });
    if (String(url).endsWith("/forum/register")) return response(profile);
    if (String(url).endsWith("/forum/avatar")) return ++avatarAttempts === 1 ? response({ message: "Upload failed" }, 500) : response({ ...profile, avatar_url: "/uploads/forum/avatar.png" });
    throw new Error("Unexpected request");
  });
  mount();
  await screen.findByText("42:main-token");
  await screen.findByText("inactive:none:ready");
  const file = new File(["avatar"], "avatar.png", { type: "image/png" });
  await act(async () => { await expect(auth.registerForum("ForumUser", true, file)).rejects.toThrow("Upload failed"); });
  expect(auth.forumUser?.username).toBe("ForumUser");
  expect(auth.forumSessionActive).toBe(false);
  await act(async () => { await auth.registerForum("ForumUser", true, file); });
  expect(auth.forumSessionActive).toBe(true);
  expect((fetch as jest.Mock).mock.calls.filter(([url]) => String(url).endsWith("/forum/register"))).toHaveLength(1);
  const registration = (fetch as jest.Mock).mock.calls.find(([url]) => String(url).endsWith("/forum/register"))[1];
  expect(JSON.parse(registration.body)).toEqual({ username: "ForumUser", agreedToRules: true });
  const upload = (fetch as jest.Mock).mock.calls.find(([url]) => String(url).endsWith("/forum/avatar"))[1];
  expect(upload.body.get("file")).toBe(file);
  expect(upload.headers["Content-Type"]).toBeUndefined();
});

test("storage unavailable does not break forum exit", async () => {
  mount(); await screen.findByText("active:ForumUser:ready");
  const spy = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage unavailable"); });
  fireEvent.click(screen.getByText("exit"));
  expect(auth.forumSessionActive).toBe(false);
  await act(async () => { await auth.checkForumStatus(); });
  expect(auth.forumSessionActive).toBe(false);
  expect(auth.forumUser).toBeNull();
  spy.mockRestore();
});

test("forum exit preserves only private membership recovery and banned notice", async () => {
  (fetch as jest.Mock).mockImplementation(async url => String(url).endsWith("/auth/profile") ? response(mainUser) :
    response({ registered: true, forumUser: { ...profile, banned: true } }));
  mount(); await screen.findByText("active:ForumUser:ready");
  fireEvent.click(screen.getByText("exit"));
  expect(auth.forumUser).toBeNull();
  expect(auth.forumBanned).toBe(true);
  await act(async () => { await auth.checkForumStatus(); });
  expect(auth.forumUser).toBeNull();
  expect(auth.forumBanned).toBe(true);
  expect(auth.forumSessionActive).toBe(false);
});

test("avatar retry after exit uses private cache without duplicate registration", async () => {
  mount(); await screen.findByText("active:ForumUser:ready");
  fireEvent.click(screen.getByText("exit"));
  (fetch as jest.Mock).mockResolvedValueOnce(response({ ...profile, avatar_url: "/uploads/forum/a.png" }));
  const avatar = new File(["avatar"], "a.png", { type: "image/png" });
  await act(async () => { await auth.registerForum("", true, avatar); });
  expect(auth.forumUser?.username).toBe("ForumUser");
  expect(auth.forumSessionActive).toBe(true);
  expect((fetch as jest.Mock).mock.calls.some(([url]) => String(url).endsWith("/forum/register"))).toBe(false);
});

test("Russian context provides translated validation and status fallbacks", async () => {
  localStorage.setItem("lang", "RU");
  render(<LanguageProvider><AuthProvider><Probe /></AuthProvider></LanguageProvider>);
  await screen.findByText("active:ForumUser:ready");
  await act(async () => { await expect(auth.registerForum("", false)).rejects.toThrow("примите правила"); });
  (fetch as jest.Mock).mockResolvedValueOnce(response({}, 500));
  await act(async () => { await expect(auth.checkForumStatus()).rejects.toThrow("Не удалось проверить"); });
});

test("failed status check never activates the forum or clears main session", async () => {
  (fetch as jest.Mock).mockImplementation(async url =>
    String(url).endsWith("/auth/profile") ? response(mainUser) : response({}, 500));
  mount();
  await screen.findByText("42:main-token");
  await screen.findByText("inactive:none:ready");
  expect(auth.forumSessionActive).toBe(false);
  expect(auth.token).toBe("main-token");
});

test("auth switch ignores a previous user's status response", async () => {
  let finish!: (data: unknown) => void;
  let statusRequests = 0;
  (fetch as jest.Mock).mockImplementation(async (url) => {
    if (String(url).endsWith("/auth/profile")) return response(mainUser);
    if (String(url).endsWith("/auth/login")) return response({ access_token: "new-token", user: { ...mainUser, id: 99 } });
    if (++statusRequests === 1) return new Promise(resolve => { finish = resolve; });
    return response({ registered: false, forumUser: null });
  });
  mount(); await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  await act(async () => { await auth.login({ email: "other@example.com", password: "example-password" }); });
  await screen.findByText("inactive:none:ready");
  await act(async () => { finish(response({ registered: true, forumUser: profile })); });
  expect(auth.user?.id).toBe(99);
  expect(auth.forumUser).toBeNull();
});

 test("pending account check uses actual server state before session activation", async () => {
  localStorage.clear(); sessionStorage.setItem("cashback_pending_auth", "pending-token");
  let verified = false;
  (fetch as jest.Mock).mockImplementation(async (url) => {
    if (String(url).endsWith("/auth/profile")) return response({...mainUser,email_verified:verified});
    if (String(url).endsWith("/forum/status")) return response({registered:false});
    throw new Error("Unexpected offline call");
  });
  mount(); await waitFor(()=>expect(auth.loading).toBe(false));
  await act(async()=>{expect(await auth.checkVerification()).toBe(false)});
  expect(localStorage.getItem("cashback_token")).toBeNull();
  verified=true;
  await act(async()=>{expect(await auth.checkVerification()).toBe(true)});
  expect(auth.user?.email_verified).toBe(true);
  expect(localStorage.getItem("cashback_token")).toBe("pending-token");
 });

test.each([401,429,503,403])('login status %s never leaks backend response details',async status=>{
 localStorage.clear();const body=jest.fn(async()=>({message:'User not found; database secret'}));
 (fetch as jest.Mock).mockResolvedValue({ok:false,status,json:body,text:body});mount();
 let failure:any;await act(async()=>{failure=await auth.login({email:'buyer@example.test',password:'synthetic'}).catch(e=>e)});
 expect(failure.kind).toBe(status===401?'credentials':status===429?'limited':status===503?'server':'unknown');
 expect(failure.message).not.toMatch(/User not found|database secret/);expect(body).not.toHaveBeenCalled();expect(auth.user).toBeNull();expect(localStorage.getItem('cashback_token')).toBeNull();
});
test('network failure receives a safe login category without exposing transport details',async()=>{
 localStorage.clear();(fetch as jest.Mock).mockRejectedValue(new TypeError('private endpoint details'));mount();let failure:any;
 await act(async()=>{failure=await auth.login({email:'buyer@example.test',password:'synthetic'}).catch(e=>e)});expect(failure.kind).toBe('network');expect(failure.message).not.toContain('private endpoint');
});


test.each([204,401,503])('logout status %s reports server confirmation accurately and clears locally', async status => {
  mount();await waitFor(()=>expect(auth.forumUser?.id).toBe(profile.id));
  (fetch as jest.Mock).mockResolvedValueOnce(response(null,status));
  let confirmed: boolean | undefined;
  await act(async()=>{confirmed=await auth.logout();});
  expect(confirmed).toBe(status===204);
  expect(auth.user).toBeNull();expect(auth.token).toBeNull();expect(localStorage.getItem('cashback_token')).toBeNull();
  const calls=(fetch as jest.Mock).mock.calls.filter(([url])=>String(url).endsWith('/auth/logout-all'));
  expect(calls).toHaveLength(1);expect(calls[0][1]).toMatchObject({method:'POST',headers:{Authorization:'Bearer main-token'}});
  await act(async()=>{expect(await auth.logout()).toBe(false);});
  expect((fetch as jest.Mock).mock.calls.filter(([url])=>String(url).endsWith('/auth/logout-all'))).toHaveLength(1);
});

test('logout network failure clears locally without reporting server revocation or retrying',async()=>{
  mount();await waitFor(()=>expect(auth.forumUser?.id).toBe(profile.id));
  (fetch as jest.Mock).mockRejectedValueOnce(new Error('synthetic network failure'));
  await act(async()=>{expect(await auth.logout()).toBe(false);});
  expect(auth.token).toBeNull();expect(localStorage.getItem('cashback_token')).toBeNull();
  expect((fetch as jest.Mock).mock.calls.filter(([url])=>String(url).endsWith('/auth/logout-all'))).toHaveLength(1);
});

test('logout timeout aborts only its request and remains unconfirmed',async()=>{
  mount();await waitFor(()=>expect(auth.forumUser?.id).toBe(profile.id));
  jest.useFakeTimers();
  try {
    let signal: AbortSignal | undefined;
    (fetch as jest.Mock).mockImplementationOnce((_url,options:RequestInit)=>new Promise((_resolve,reject)=>{
      signal=options.signal!;signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')));
    }));
    let pending!:Promise<boolean>;act(()=>{pending=auth.logout();});
    expect(auth.token).toBeNull();
    await act(async()=>{jest.advanceTimersByTime(5000);expect(await pending).toBe(false);});
    expect(signal?.aborted).toBe(true);
    expect((fetch as jest.Mock).mock.calls.filter(([url])=>String(url).endsWith('/auth/logout-all'))).toHaveLength(1);
  } finally {jest.useRealTimers();}
});

test('a late login response cannot restore a locally logged-out session',async()=>{
  localStorage.clear();mount();
  let finish!:(value:unknown)=>void;
  (fetch as jest.Mock).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  let pending!:Promise<unknown>;act(()=>{pending=auth.login({email:mainUser.email,password:'synthetic-only'}).catch(error=>error);});
  await act(async()=>{expect(await auth.logout()).toBe(false);});
  await act(async()=>{finish(response({access_token:'late-token',user:mainUser}));expect(await pending).toBeInstanceOf(Error);});
  expect(auth.token).toBeNull();expect(localStorage.getItem('cashback_token')).toBeNull();
});

// Password change has already revoked sv on the server. Do not POST logout-all again.
test("password-change local cleanup removes only the matching session without a second mutation",async()=>{
 mount();await screen.findByText("42:main-token");
 const count=(fetch as jest.Mock).mock.calls.length;
 act(()=>{expect(auth.clearSessionAfterPasswordChange("different-session")).toBe(false);});
 expect(auth.user?.id).toBe(42);
 act(()=>{expect(auth.clearSessionAfterPasswordChange("main-token")).toBe(true);});
 expect(auth.user).toBeNull();expect(auth.token).toBeNull();
 expect(localStorage.getItem("cashback_token")).toBeNull();
 expect(sessionStorage.getItem("cashback_pending_auth")).toBeNull();
 expect((fetch as jest.Mock).mock.calls.length).toBe(count);
 expect(typeof auth.register).toBe("function");expect(typeof auth.verifyEmail).toBe("function");
});
