import React from "react";
import { fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import * as Auth from "../context/AuthContext";
import ForumGuard from "../components/ForumGuard";
import ForumAuthor from "../components/ForumAuthor";
import ForumRegister from "./ForumRegister";
import ForumRules from "./ForumRules";
import TopicsPage from "./TopicsPage";
import Topic from "./Topic";
import { forumAvatarUrl, validateForumAvatar } from "../forum";
import { LanguageProvider } from "../context/LanguageContext";
import { AppRoutes } from "../App";

const mainUser = { id: 42, email: "private@example.com", name: "Private Name", email_verified: true };
const profile = {
  id: 7, user_id: 42, username: "ForumUser", avatar_url: "/avatars/a.png", created_at: "2026-01-01",
  agreed_to_rules: true, agreed_to_rules_at: "2026-01-01", updated_at: "2026-01-01", banned: false,
};
let auth: ReturnType<typeof Auth.useAuth>;
beforeEach(() => {
  localStorage.clear();
  auth = {
    user: mainUser, token: "main-token", loading: false, isEmailVerificationPending: false,
    forumUser: null, forumSessionActive: false, forumLoading: false, forumRegistered: false, forumBanned: false,
    login: jest.fn(), register: jest.fn(), verifyEmail: jest.fn(), resendVerification: jest.fn(),
    logout: jest.fn(), registerForum: jest.fn().mockResolvedValue(undefined),
    logoutFromForum: jest.fn(), checkForumStatus: jest.fn().mockResolvedValue(undefined),
  };
  jest.spyOn(Auth, "useAuth").mockImplementation(() => auth);
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 }) as jest.Mock;
});
afterEach(() => jest.restoreAllMocks());

function guard(readOnly = false) {
  return render(<MemoryRouter initialEntries={["/protected"]}><Routes>
    <Route element={<ForumGuard readOnly={readOnly} />}><Route path="/protected" element={<p>Forum content</p>} /></Route>
    <Route path="/register" element={<p>Main registration</p>} />
    <Route path="/verify-email" element={<p>Verify email</p>} />
    <Route path="/forum/register" element={<p>Forum registration</p>} />
  </Routes></MemoryRouter>);
}
test("strict guard requires main authentication", () => { auth.user = null; guard(); expect(screen.getByText("Main registration")).toBeInTheDocument(); });
test("read-only guard still requires verified email", () => { auth.user = { ...mainUser, email_verified: false }; guard(true); expect(screen.getByText("Verify email")).toBeInTheDocument(); });
test("strict guard redirects inactive membership to forum registration", () => { auth.forumUser = profile; guard(); expect(screen.getByText("Forum registration")).toBeInTheDocument(); });
test("strict guard allows active nonbanned membership", () => { auth.forumUser = profile; auth.forumSessionActive = true; guard(); expect(screen.getByText("Forum content")).toBeInTheDocument(); });
test("strict guard blocks banned members", () => { auth.forumUser = { ...profile, banned: true }; auth.forumSessionActive = true; guard(); expect(screen.getByRole("alert")).toHaveTextContent("banned"); expect(screen.queryByText("Forum content")).not.toBeInTheDocument(); });
test("read-only allows unregistered and banned members with ban notice", () => {
  const { unmount } = guard(true); expect(screen.getByText("Forum content")).toBeInTheDocument(); unmount();
  auth.forumUser = { ...profile, banned: true }; guard(true);
  expect(screen.getByRole("alert")).toHaveTextContent("banned"); expect(screen.getByText("Forum content")).toBeInTheDocument();
});

test("read-only banned notice survives cleared forum user after exit", () => {
  auth.forumUser = null; auth.forumBanned = true; auth.forumRegistered = true;
  guard(true);
  expect(screen.getByRole("alert")).toHaveTextContent("banned");
  expect(screen.getByText("Forum content")).toBeInTheDocument();
});

function registration() {
  return render(<MemoryRouter initialEntries={["/forum/register"]}><Routes>
    <Route path="/forum/register" element={<ForumRegister />} />
    <Route path="/forum" element={<p>Redirected forum</p>} />
  </Routes></MemoryRouter>);
}
test("registration has readonly account fields, availability and mandatory agreement", async () => {
  registration();
  expect(screen.getByLabelText("Email")).toHaveAttribute("readonly");
  expect(screen.getByLabelText("Name")).toHaveAttribute("readonly");
  expect(screen.getByLabelText("Email")).toHaveStyle({ background: "#eee", color: "#666" });
  expect(screen.getByLabelText("Name")).toHaveStyle({ background: "#eee", color: "#666" });
  expect(screen.getByLabelText("Username")).toHaveAttribute("minlength", "3");
  expect(screen.getByRole("checkbox")).toBeRequired();
  expect(screen.getByRole("checkbox")).toHaveAccessibleName(/Rule violations may result in deletion of your forum account or a ban/);
  const submit = screen.getByRole("button", { name: "Register for forum" });
  expect(submit).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Username"), { target: { value: "a!" } });
  expect((fetch as jest.Mock).mock.calls.some(([url]) => String(url).includes("/forum/user/"))).toBe(false);
  fireEvent.change(screen.getByLabelText("Username"), { target: { value: "Good_user" } });
  await screen.findByText("Username available");
  expect(submit).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox"));
  expect(submit).toBeEnabled();
  fireEvent.click(submit);
  await screen.findByText(/Success!/);
  expect(auth.registerForum).toHaveBeenCalledWith("Good_user", true, undefined);
});

test.each([200, 500, 403])("availability fails closed for HTTP %s", async status => {
  (fetch as jest.Mock).mockResolvedValue({ ok: status === 200, status });
  registration();
  fireEvent.change(screen.getByLabelText("Username"), { target: { value: "Good_user" } });
  fireEvent.click(screen.getByRole("checkbox"));
  await waitFor(() => expect(fetch).toHaveBeenCalled());
  await screen.findByText(status === 200 ? "Username taken" : /Could not check availability/);
  expect(screen.getByRole("button", { name: "Register for forum" })).toBeDisabled();
});

test("network availability failures do not enable registration", async () => {
  (fetch as jest.Mock).mockRejectedValue(new Error("Network down"));
  registration();
  fireEvent.change(screen.getByLabelText("Username"), { target: { value: "Good_user" } });
  fireEvent.click(screen.getByRole("checkbox"));
  await screen.findByText(/Could not check availability/);
  expect(screen.getByRole("button", { name: "Register for forum" })).toBeDisabled();
});

test("invalid avatar blocks submission", () => {
  registration();
  fireEvent.change(screen.getByLabelText("Avatar (optional)"), { target: { files: [new File(["bad"], "bad.gif", { type: "image/gif" })] } });
  expect(screen.getByRole("alert")).toHaveTextContent("maximum 500 KB");
  expect(screen.getByRole("button", { name: "Register for forum" })).toBeDisabled();
});

test("existing account can reenter without registering", async () => {
  auth.forumUser = profile; registration();
  expect(screen.queryByLabelText("Username")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Enter forum without uploading an avatar" }));
  await screen.findByText("Redirected forum");
  expect(auth.checkForumStatus).toHaveBeenCalledWith(true);
  expect(auth.registerForum).not.toHaveBeenCalled();
});

test("exited account with cleared forumUser still offers reentry", async () => {
  auth.forumUser = null; auth.forumRegistered = true;
  registration();
  expect(screen.queryByLabelText("Username")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Enter forum without uploading an avatar" }));
  await screen.findByText("Redirected forum");
  expect(auth.checkForumStatus).toHaveBeenCalledWith(true);
  expect(auth.registerForum).not.toHaveBeenCalled();
});
test("avatar failure after registration shows recovery rather than success or duplicate registration", async () => {
  (auth.registerForum as jest.Mock).mockImplementation(async () => {
    auth.forumUser = profile;
    throw new Error("Avatar upload failed");
  });
  registration();
  fireEvent.change(screen.getByLabelText("Username"), { target: { value: "ForumUser" } });
  await screen.findByText("Username available");
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.change(screen.getByLabelText("Avatar (optional)"), { target: { files: [new File(["avatar"], "avatar.png", { type: "image/png" })] } });
  fireEvent.click(screen.getByRole("button", { name: "Register for forum" }));
  await screen.findByText(/No duplicate registration is needed/);
  expect(screen.getByRole("alert")).toHaveTextContent("Avatar upload failed");
  expect(screen.queryByText(/Success!/)).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Username")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Enter forum without uploading an avatar" }));
  await screen.findByText("Redirected forum");
  expect(auth.registerForum).toHaveBeenCalledTimes(1);
});

test("success redirects after two seconds and unmount cancels timer", async () => {
  jest.useFakeTimers();
  try {
    auth.forumUser = profile;
    const registrationComplete = Promise.resolve();
    (auth.registerForum as jest.Mock).mockReturnValue(registrationComplete);
    const view = registration();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Retry upload and enter" }));
    await act(async () => { await registrationComplete; });
    expect(screen.getByRole("status")).toHaveTextContent("2 seconds");
    act(() => { jest.advanceTimersByTime(1999); });
    expect(screen.queryByText("Redirected forum")).not.toBeInTheDocument();
    act(() => { jest.advanceTimersByTime(1); });
    expect(screen.getByText("Redirected forum")).toBeInTheDocument();
    view.unmount();
    const utils = registration();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Retry upload and enter" }));
    await act(async () => { await registrationComplete; });
    const timers = jest.getTimerCount();
    utils.unmount();
    expect(jest.getTimerCount()).toBeLessThan(timers);
  } finally { jest.useRealTimers(); }
});

test("public rules include both languages and no legal compliance promise", () => {
  render(<MemoryRouter><ForumRules /></MemoryRouter>);
  expect(screen.getByText("English")).toBeInTheDocument();
  expect(screen.getByText("Русский")).toBeInTheDocument();
  expect(screen.getByText(/do not assert legal compliance/)).toBeInTheDocument();
  expect(screen.getByText(/Rule violations may result in deletion of your forum account or a ban/)).toBeInTheDocument();
  expect(screen.getByText(/Нарушения могут привести к удалению вашего аккаунта форума или блокировке/)).toBeInTheDocument();
  for (const heading of ["General rules", "Posting guidelines", "Prohibited content", "Moderation", "Consequences", "Account deletion"]) {
    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
  }
  expect(screen.getByText(/permanent deletion of your forum account/)).toBeInTheDocument();
  expect(screen.getByText(/окончательному удалению вашего аккаунта форума/)).toBeInTheDocument();
});

test("rules fetch published bilingual rules without authentication", async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ en: "Published English rules", ru: "Опубликованные правила" }) });
  render(<MemoryRouter><ForumRules /></MemoryRouter>);
  await screen.findByText("Published English rules");
  expect(screen.getByText("Опубликованные правила")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith("http://localhost:3001/forum/rules", expect.objectContaining({ signal: expect.anything() }));
});

test("lower-case language context renders Russian registration and deletion/ban warnings", () => {
  localStorage.setItem("lang", "RU");
  render(<LanguageProvider><MemoryRouter><ForumRegister /></MemoryRouter></LanguageProvider>);
  expect(screen.getByText("Регистрация на форуме")).toBeInTheDocument();
  expect(screen.getByRole("checkbox")).toHaveAccessibleName(/удалены/);
  expect(screen.getByRole("checkbox")).toHaveAccessibleName(/Нарушения могут привести к удалению вашего аккаунта форума или блокировке/);
});
test("authors display only forum username, avatar and joining date", () => {
  render(<ForumAuthor lang="en" author={{ ...profile, name: mainUser.name, email: mainUser.email } as any} />);
  expect(screen.getByText("ForumUser")).toBeInTheDocument();
  expect(screen.getByText(/Joined/)).toBeInTheDocument();
  expect(screen.queryByText(mainUser.email)).not.toBeInTheDocument();
  expect(screen.queryByText(mainUser.name)).not.toBeInTheDocument();
  expect(screen.getByRole("presentation")).toHaveAttribute("src", "http://localhost:3001/avatars/a.png");
});

test("topics and posts are readable without exposing write UI", async () => {
  (fetch as jest.Mock).mockImplementation(async url => ({
    ok: true, json: async () => String(url).includes("/forum/topics") ? [{ id: 1, title: "Discussion", created_at: "2026-02-01", author: profile }] :
      String(url).includes("/forum/posts") ? [{ id: 1, content: "Public message", created_at: "2026-02-01", author: profile }] :
      { id: 1, title: "Discussion", author: profile },
  }));
  const { unmount } = render(<MemoryRouter><TopicsPage lang="EN" /></MemoryRouter>);
  await screen.findByText("Discussion");
  expect(screen.queryByRole("button", { name: /New topic/i })).not.toBeInTheDocument();
  unmount();
  render(<MemoryRouter initialEntries={["/topic/1"]}><Routes><Route path="/topic/:id" element={<Topic lang="EN" />} /></Routes></MemoryRouter>);
  await screen.findByText("Public message");
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});

test("read-only topic list and discussion requests authenticate with the current main token", async () => {
  (fetch as jest.Mock).mockImplementation(async url => ({
    ok: true, json: async () => String(url).endsWith("/forum/topics") ? [{ id: 1, title: "Authenticated discussion", created_at: "2026-02-01", author: profile }] :
      String(url).includes("/forum/posts/") ? [] : { id: 1, title: "Authenticated discussion", author: profile },
  }));
  const view = render(<MemoryRouter><TopicsPage lang="en" /></MemoryRouter>);
  await screen.findByText("Authenticated discussion");
  expect(fetch).toHaveBeenCalledWith("http://localhost:3001/forum/topics", expect.objectContaining({
    headers: { Authorization: "Bearer " + auth.token },
    signal: expect.anything(),
  }));
  view.unmount();
  render(<MemoryRouter initialEntries={["/forum/topics/1"]}><Routes>
    <Route path="/forum/topics/:id" element={<Topic lang="en" />} />
  </Routes></MemoryRouter>);
  await screen.findByText("Authenticated discussion");
  for (const endpoint of ["/forum/topic/1", "/forum/posts/1"]) {
    expect(fetch).toHaveBeenCalledWith(`http://localhost:3001${endpoint}`, expect.objectContaining({
      headers: { Authorization: "Bearer " + auth.token },
      signal: expect.anything(),
    }));
  }
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});

test("topic list token switches abort stale reads and clear old discussion data", async () => {
  const initialToken = auth.token;
  let oldSignal!: AbortSignal;
  let resolveOld!: (data: unknown) => void;
  (fetch as jest.Mock).mockImplementation(async (_url, options) => {
    if (options.headers.Authorization === "Bearer " + initialToken) {
      oldSignal = options.signal;
      return new Promise(resolve => { resolveOld = resolve; });
    }
    return { ok: true, json: async () => [{ id: 2, title: "New session discussion", created_at: "2026-02-01", author: profile }] };
  });
  const view = render(<MemoryRouter><TopicsPage lang="en" /></MemoryRouter>);
  auth.token = "new-session-token";
  view.rerender(<MemoryRouter><TopicsPage lang="en" /></MemoryRouter>);
  await screen.findByText("New session discussion");
  expect(oldSignal.aborted).toBe(true);
  await act(async () => { resolveOld({ ok: true, json: async () => [{ id: 1, title: "Old session discussion", created_at: "2026-02-01", author: profile }] }); });
  expect(screen.queryByText("Old session discussion")).not.toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith("http://localhost:3001/forum/topics", expect.objectContaining({
    headers: { Authorization: "Bearer " + auth.token },
  }));
});

test.each(["/forum", "/forum/topics", "/forum/topics/1", "/forum/topic/1", "/topic/1"])("application route %s preserves read-only access and topic alias compatibility", async path => {
  (fetch as jest.Mock).mockImplementation(async url => ({
    ok: true, json: async () => String(url).includes("/forum/topics") ? [{ id: 1, title: "Contract discussion", created_at: "2026-02-01", author: profile }] :
      String(url).includes("/forum/posts") ? [] : { id: 1, title: "Contract discussion", author: profile },
  }));
  render(<LanguageProvider><MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter></LanguageProvider>);
  await screen.findByText("Contract discussion");
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});

test("banned active membership never exposes topic creation or message inputs", async () => {
  auth.forumUser = { ...profile, banned: true }; auth.forumSessionActive = true;
  (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [] });
  const { unmount } = render(<MemoryRouter><TopicsPage lang="en" /></MemoryRouter>);
  await screen.findByText(/No topics/i);
  expect(screen.queryByRole("button", { name: /new topic/i })).not.toBeInTheDocument();
  unmount();
  render(<MemoryRouter><Topic lang="en" /></MemoryRouter>);
  await screen.findByText(/No messages/i);
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});
test("active forum header exit invokes only forum logout", async () => {
  auth.forumUser = profile; auth.forumSessionActive = true;
  (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [] });
  render(<MemoryRouter><TopicsPage lang="en" /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Exit Forum" }));
  expect(auth.logoutFromForum).toHaveBeenCalled();
  expect(auth.logout).not.toHaveBeenCalled();
  await screen.findByText(/first/i);
});

test("avatar validation enforces exact byte limit and safe backend origin", () => {
  expect(validateForumAvatar(new File([new Uint8Array(500 * 1024)], "a.webp", { type: "image/webp" }))).toBe(true);
  expect(validateForumAvatar(new File([new Uint8Array(500 * 1024 + 1)], "a.png", { type: "image/png" }))).toBe(false);
  expect(validateForumAvatar(new File([], "empty.png", { type: "image/png" }))).toBe(false);
  expect(forumAvatarUrl("/uploads/forum/a.png")).toBe("http://localhost:3001/uploads/forum/a.png");
  for (const scheme of ["javascript", "data"]) expect(forumAvatarUrl(`${scheme}:invalid`)).toBeUndefined();
  expect(forumAvatarUrl("//evil.example/a.png")).toBeUndefined();
});
