import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";

const oldUser = { id: 1, name: "Old", email: "old@example.test", bonusEligible: false };
const newUser = { id: 2, name: "New", email: "new@example.test", bonusEligible: true };
const response = (data: unknown, ok = true, status = ok ? 200 : 400) =>
  ({ ok, status, json: async () => data } as Response);
const deferred = () => {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((done) => { resolve = done; });
  return { promise, resolve };
};

function Probe() {
  const { user, token, loading, sessionVersion, login, register, logout, refreshUser } = useAuth();
  const captured = React.useRef<{ token: string; sessionVersion: number; bonusEligible: true } | null>(null);
  return <div>
    <span data-testid="session">{loading ? "loading" : `${user?.name ?? "guest"}:${token ?? "none"}:${user?.bonusEligible ?? false}`}</span>
    <button onClick={() => { void login({ email: "new@example.test", password: "pass" }).catch(() => {}); }}>login</button>
    <button onClick={() => { void register({ name: "New", email: "new@example.test", password: "pass" }).catch(() => {}); }}>register</button>
    <button onClick={logout}>logout</button>
    <button onClick={() => { void refreshUser().catch(() => {}); }}>refresh</button>
    <button onClick={() => {
      if (token) void refreshUser({ token, sessionVersion, bonusEligible: true }).catch(() => {});
    }}>confirmed refresh</button>
    <button onClick={() => {
      if (token) captured.current = { token, sessionVersion, bonusEligible: true };
    }}>capture confirmation</button>
    <button onClick={() => {
      if (captured.current) void refreshUser(captured.current).catch(() => {});
    }}>stale confirmation</button>
  </div>;
}

beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn();
});

const mount = () => render(<AuthProvider><Probe /></AuthProvider>);

test("restores server eligibility from JWT rather than browser eligibility flags", async () => {
  localStorage.setItem("cashback_token", "stored");
  (fetch as jest.Mock).mockResolvedValue(response(newUser));
  mount();
  expect(await screen.findByText("New:stored:true")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith("http://localhost:3001/auth/profile", {
    headers: { Authorization: "Bearer " + localStorage.getItem("cashback_token") },
  });
});

test.each(["login", "register"])("stale restoration cannot overwrite newer %s", async (action) => {
  localStorage.setItem("cashback_token", "old-token");
  const restore = deferred();
  (fetch as jest.Mock).mockReturnValueOnce(restore.promise).mockResolvedValueOnce(response({ access_token: "new-token", user: newUser }));
  mount();
  fireEvent.click(screen.getByText(action));
  await screen.findByText("New:new-token:true");
  await act(async () => { restore.resolve(response(oldUser)); });
  expect(screen.getByTestId("session")).toHaveTextContent("New:new-token:true");
  expect(localStorage.getItem("cashback_token")).toBe("new-token");
});

test.each(["login", "register"])("failed stale restoration cannot remove %s token", async (action) => {
  localStorage.setItem("cashback_token", "old-token");
  const restore = deferred();
  (fetch as jest.Mock).mockReturnValueOnce(restore.promise).mockResolvedValueOnce(response({ access_token: "new-token", user: newUser }));
  mount();
  fireEvent.click(screen.getByText(action));
  await screen.findByText("New:new-token:true");
  await act(async () => { restore.resolve(response({}, false)); });
  expect(screen.getByTestId("session")).toHaveTextContent("New:new-token:true");
  expect(localStorage.getItem("cashback_token")).toBe("new-token");
});

test("stale restoration cannot resurrect logout", async () => {
  localStorage.setItem("cashback_token", "old-token");
  const restore = deferred();
  (fetch as jest.Mock).mockReturnValueOnce(restore.promise);
  mount();
  fireEvent.click(screen.getByText("logout"));
  await act(async () => { restore.resolve(response(oldUser)); });
  expect(screen.getByTestId("session")).toHaveTextContent("guest:none:false");
  expect(localStorage.getItem("cashback_token")).toBeNull();
});

test.each(["login", "register"])("in-flight %s cannot resurrect logout", async (action) => {
  const request = deferred();
  (fetch as jest.Mock).mockReturnValueOnce(request.promise);
  mount();
  fireEvent.click(screen.getByText(action));
  fireEvent.click(screen.getByText("logout"));
  await act(async () => { request.resolve(response({ access_token: "late-token", user: newUser })); });
  expect(screen.getByTestId("session")).toHaveTextContent("guest:none:false");
  expect(localStorage.getItem("cashback_token")).toBeNull();
});

test.each([["login", "register"], ["register", "login"]])("newer %s/%s action wins over an earlier request", async (first, second) => {
  const earlier = deferred();
  (fetch as jest.Mock).mockReturnValueOnce(earlier.promise).mockResolvedValueOnce(response({ access_token: "newer-token", user: newUser }));
  mount();
  fireEvent.click(screen.getByText(first));
  fireEvent.click(screen.getByText(second));
  await screen.findByText("New:newer-token:true");
  await act(async () => { earlier.resolve(response({ access_token: "late-token", user: oldUser })); });
  expect(screen.getByTestId("session")).toHaveTextContent("New:newer-token:true");
});

test("in-flight profile refresh cannot resurrect logout", async () => {
  localStorage.setItem("cashback_token", "old-token");
  const refresh = deferred();
  (fetch as jest.Mock).mockResolvedValueOnce(response(oldUser)).mockReturnValueOnce(refresh.promise);
  mount();
  await screen.findByText("Old:old-token:false");
  fireEvent.click(screen.getByText("refresh"));
  fireEvent.click(screen.getByText("logout"));
  await act(async () => { refresh.resolve(response(newUser)); });
  expect(screen.getByTestId("session")).toHaveTextContent("guest:none:false");
});

test("invalid session clears token and finishes loading", async () => {
  localStorage.setItem("cashback_token", "expired");
  (fetch as jest.Mock).mockResolvedValue(response({}, false));
  mount();
  await waitFor(() => expect(screen.getByTestId("session")).toHaveTextContent("guest:none:false"));
  expect(localStorage.getItem("cashback_token")).toBeNull();
});

test.each(["login", "register", "logout"])("confirmed refresh fallback cannot affect a newer %s session", async (action) => {
  localStorage.setItem("cashback_token", "old-token");
  const refresh = deferred();
  const newerUser = { ...newUser, bonusEligible: false };
  (fetch as jest.Mock)
    .mockResolvedValueOnce(response(oldUser))
    .mockReturnValueOnce(refresh.promise)
    .mockResolvedValueOnce(response({ access_token: "new-token", user: newerUser }));
  mount();
  await screen.findByText("Old:old-token:false");
  fireEvent.click(screen.getByText("confirmed refresh"));
  fireEvent.click(screen.getByText(action));
  await screen.findByText(action === "logout" ? "guest:none:false" : "New:new-token:false");
  await act(async () => { refresh.resolve(response({}, false, 503)); });
  expect(screen.getByTestId("session")).toHaveTextContent(
    action === "logout" ? "guest:none:false" : "New:new-token:false",
  );
});

test("a late POST confirmation cannot update a newer login even when the token string is reused", async () => {
  localStorage.setItem("cashback_token", "reused-token");
  (fetch as jest.Mock)
    .mockResolvedValueOnce(response(oldUser))
    .mockResolvedValueOnce(response({ access_token: "reused-token", user: { ...newUser, bonusEligible: false } }))
    .mockRejectedValueOnce(new TypeError("Network unavailable"));
  mount();
  await screen.findByText("Old:reused-token:false");
  fireEvent.click(screen.getByText("capture confirmation"));
  fireEvent.click(screen.getByText("login"));
  await screen.findByText("New:reused-token:false");
  fireEvent.click(screen.getByText("stale confirmation"));
  expect(screen.getByTestId("session")).toHaveTextContent("New:reused-token:false");
  expect(fetch).toHaveBeenCalledTimes(2);
});
