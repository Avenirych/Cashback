import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "./App";
import { translations } from "./i18n";

jest.mock("./pages/Shop", () => () => <h1>Shopping preserved</h1>);
jest.mock("./components/MoneyTree", () => () => <div />);

const user = { id: 7, name: "Alex", email: "alex@example.test", balance: 0, bonusEligible: false };
const state = { bonusEligible: false, noticeVersion: "2026-10-draft", termsVersion: "2026-10-draft" };
const saved = {
  ...state, bonusEligible: true,
  recipient: { accountHolderNameMasked: "A***", sortCodeMasked: "**-**-56", accountNumberMasked: "****1234" },
};
const response = (data: unknown, ok = true, status = ok ? 200 : 400) =>
  ({ ok, status, json: async () => data } as Response);
let eligible: boolean;
let saveOk: boolean;
let fetchMock: jest.Mock;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("cookiesAccepted", "necessary");
  localStorage.setItem("cashback_token", "session");
  eligible = false;
  saveOk = true;
  fetchMock = jest.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith("/auth/profile")) return response({ ...user, bonusEligible: eligible });
    if (url.endsWith("/onboarding") && options?.method === "POST") {
      if (saveOk) eligible = true;
      return response(saveOk ? saved : { message: "sensitive server detail" }, saveOk);
    }
    if (url.endsWith("/onboarding")) return response(eligible ? saved : state);
    throw new Error("Unexpected request");
  });
  global.fetch = fetchMock;
});

const mount = (path = "/") => {
  window.history.replaceState({}, "", path);
  return render(<App />);
};
const openModal = async () => {
  mount("/profile");
  const button = await screen.findByRole("button", { name: translations.EN.onboarding.join });
  await waitFor(() => expect(button).toBeEnabled());
  button.focus();
  fireEvent.click(button);
  return screen.getByRole("dialog");
};
const fill = (dialog: HTMLElement) => {
  const scope = within(dialog);
  fireEvent.change(scope.getByLabelText(translations.EN.onboarding.holder), { target: { value: "Alex Example" } });
  fireEvent.change(scope.getByLabelText(translations.EN.onboarding.sortCode), { target: { value: "00-12-34" } });
  fireEvent.change(scope.getByLabelText(translations.EN.onboarding.account), { target: { value: "00001234" } });
  fireEvent.click(scope.getByLabelText(translations.EN.onboarding.privacyAck));
  fireEvent.click(scope.getByLabelText(translations.EN.onboarding.accuracy));
};
const posts = () => fetchMock.mock.calls.filter(([, options]) => options?.method === "POST");

test("guest CTA retains registration flow; shopping remains unchanged", async () => {
  localStorage.removeItem("cashback_token");
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "Get bonuses" }));
  expect(window.location.pathname).toBe("/register");
  expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
});

test("unenrolled home CTA opens profile and does not require £10 to join", async () => {
  mount();
  await screen.findByText(translations.EN.bonusNotReady);
  fireEvent.click(screen.getByRole("button", { name: "Get bonuses" }));
  expect(await screen.findByRole("heading", { name: "Profile" })).toBeInTheDocument();
  expect(screen.getByText(translations.EN.onboarding.intro)).toBeInTheDocument();
});

test("shopping stays accessible for authenticated users without bonus eligibility", async () => {
  mount();
  const button = await screen.findByRole("button", { name: "Go shopping" });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  expect(await screen.findByRole("heading", { name: "Shopping preserved" })).toBeInTheDocument();
});

test("modal validates locally, traps keyboard focus, and cancels without saving", async () => {
  const dialog = await openModal();
  const scope = within(dialog);
  expect(scope.getByLabelText(translations.EN.onboarding.holder)).toHaveFocus();
  expect(scope.getAllByRole("checkbox").every((box) => !(box as HTMLInputElement).checked)).toBe(true);
  fireEvent.click(scope.getByRole("button", { name: translations.EN.onboarding.save }));
  expect(scope.getByRole("alert")).toHaveTextContent(translations.EN.onboarding.invalid);
  for (const input of [...scope.getAllByRole("textbox"), ...scope.getAllByRole("checkbox")]) {
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", scope.getByRole("alert").id);
  }
  expect(posts()).toHaveLength(0);
  const cancel = scope.getByRole("button", { name: "Cancel" });
  cancel.focus();
  fireEvent.keyDown(cancel, { key: "Tab" });
  expect(scope.getByRole("link", { name: translations.EN.onboarding.privacy })).toHaveFocus();
  fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
  expect(cancel).toHaveFocus();
  fireEvent.keyDown(dialog, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: translations.EN.onboarding.join })).toHaveFocus();
  expect(posts()).toHaveLength(0);
  expect(window.location.pathname).toBe("/profile");
});

test.each(["1234567", "123456789", "1234abcd"])("rejects account number %s", async (account) => {
  const dialog = await openModal();
  fill(dialog);
  fireEvent.change(within(dialog).getByLabelText(translations.EN.onboarding.account), { target: { value: account } });
  fireEvent.click(within(dialog).getByRole("button", { name: translations.EN.onboarding.save }));
  expect(within(dialog).getByRole("alert")).toHaveTextContent(translations.EN.onboarding.invalid);
  expect(posts()).toHaveLength(0);
});

test.each(["", "A", "  A  "])("rejects account holder name %j before submission", async (holder) => {
  const dialog = await openModal();
  fill(dialog);
  fireEvent.change(within(dialog).getByLabelText(translations.EN.onboarding.holder), { target: { value: holder } });
  fireEvent.click(within(dialog).getByRole("button", { name: translations.EN.onboarding.save }));
  expect(within(dialog).getByRole("alert")).toHaveTextContent(translations.EN.onboarding.invalid);
  expect(posts()).toHaveLength(0);
});

test("cancel discards all entered recipient data and confirmations", async () => {
  const dialog = await openModal();
  fill(dialog);
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  fireEvent.click(screen.getByRole("button", { name: translations.EN.onboarding.join }));
  const reopened = within(screen.getByRole("dialog"));
  expect(reopened.getByLabelText(translations.EN.onboarding.holder)).toHaveValue("");
  expect(reopened.getByLabelText(translations.EN.onboarding.sortCode)).toHaveValue("");
  expect(reopened.getByLabelText(translations.EN.onboarding.account)).toHaveValue("");
  expect(reopened.getAllByRole("checkbox").every((box) => !(box as HTMLInputElement).checked)).toBe(true);
  expect(posts()).toHaveLength(0);
});

test("pending save keeps focus inside the dialog until a safe result", async () => {
  const dialog = await openModal();
  fill(dialog);
  let resolve!: (value: Response) => void;
  fetchMock.mockImplementationOnce(() => new Promise<Response>((done) => { resolve = done; }));
  fireEvent.click(within(dialog).getByRole("button", { name: translations.EN.onboarding.save }));
  expect(dialog).toHaveFocus();
  expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
  fireEvent.keyDown(dialog, { key: "Tab" });
  expect(within(dialog).getByRole("link", { name: translations.EN.onboarding.privacy })).toHaveFocus();
  await act(async () => { resolve(response({}, false)); });
  expect(within(dialog).getByRole("alert")).toHaveTextContent(translations.EN.onboarding.failure);
});

test("failed save never refreshes auth or unlocks bonuses and shows only a generic error", async () => {
  saveOk = false;
  const dialog = await openModal();
  fill(dialog);
  fireEvent.click(within(dialog).getByRole("button", { name: translations.EN.onboarding.save }));
  expect(await within(dialog).findByRole("alert")).toHaveTextContent(translations.EN.onboarding.failure);
  expect(screen.queryByText(/sensitive server detail/)).not.toBeInTheDocument();
  expect(fetchMock.mock.calls.filter(([url]) => url.endsWith("/auth/profile"))).toHaveLength(1);
  expect(screen.getByText(translations.EN.bonusNotReady)).toBeInTheDocument();
  expect(window.location.pathname).toBe("/profile");
});

test("successful validated save refreshes auth, returns home, then opens bonuses", async () => {
  const dialog = await openModal();
  fill(dialog);
  fireEvent.click(within(dialog).getByRole("button", { name: translations.EN.onboarding.save }));
  await waitFor(() => expect(window.location.pathname).toBe("/"));
  expect(screen.getByText(translations.EN.bonusReady)).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  const [, options] = posts()[0];
  expect(JSON.parse(options.body)).toEqual({
    programmeOptIn: true, privacyAcknowledged: true, accuracyConfirmed: true,
    accountHolderName: "Alex Example", sortCode: "001234", accountNumber: "00001234",
  });

  expect(options.headers.Authorization).toBe("Bearer " + localStorage.getItem("cashback_token"));
  expect(fetchMock.mock.calls.filter(([url]) => url.endsWith("/auth/profile"))).toHaveLength(2);
  expect(Object.values({ ...localStorage })).not.toContain("00001234");
  fireEvent.click(screen.getByRole("button", { name: "Get bonuses" }));
  expect(window.location.pathname).toBe("/bonuses");
});

test.each(["12345", "12a3456", "12/34/56"])("rejects sort code %s without sending bank data", async (sortCode) => {
  const dialog = await openModal();
  fill(dialog);
  fireEvent.change(within(dialog).getByLabelText(translations.EN.onboarding.sortCode), { target: { value: sortCode } });
  fireEvent.click(within(dialog).getByRole("button", { name: translations.EN.onboarding.save }));
  expect(within(dialog).getByRole("alert")).toHaveTextContent(translations.EN.onboarding.invalid);
  expect(posts()).toHaveLength(0);
});

test("requires both acknowledgements, even with valid bank details", async () => {
  const dialog = await openModal();
  fill(dialog);
  fireEvent.click(within(dialog).getByLabelText(translations.EN.onboarding.privacyAck));
  fireEvent.click(within(dialog).getByRole("button", { name: translations.EN.onboarding.save }));
  expect(posts()).toHaveLength(0);
  fireEvent.click(within(dialog).getByLabelText(translations.EN.onboarding.privacyAck));
  fireEvent.click(within(dialog).getByLabelText(translations.EN.onboarding.accuracy));
  fireEvent.click(within(dialog).getByRole("button", { name: translations.EN.onboarding.save }));
  expect(posts()).toHaveLength(0);
});

test("successful join is restored from the server on a new app mount without storing bank details", async () => {
  const dialog = await openModal();
  fill(dialog);
  fireEvent.click(within(dialog).getByRole("button", { name: translations.EN.onboarding.save }));
  await waitFor(() => expect(window.location.pathname).toBe("/"));
  cleanup();
  mount();
  expect(await screen.findByText(translations.EN.bonusReady)).toBeInTheDocument();
  expect(localStorage.getItem("cashback_token")).toBe("session");
  expect(JSON.stringify({ ...localStorage })).not.toContain("00001234");
  fireEvent.click(screen.getByRole("button", { name: "Get bonuses" }));
  expect(window.location.pathname).toBe("/bonuses");
});

test.each(["/bonuses", "/bonuses/ads", "/bonuses/research"])(
  "guards %s while restoring, then redirects unenrolled users", async (path) => {
    let resolve!: (value: Response) => void;
    const restore = new Promise<Response>((done) => { resolve = done; });
    fetchMock.mockImplementationOnce(() => restore);
    mount(path);
    expect(window.location.pathname).toBe(path);
    expect(screen.getByRole("status")).toHaveTextContent("Loading...");
    await act(async () => { resolve(response(user)); });
    expect(await screen.findByRole("heading", { name: "Profile" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/profile");
  },
);

test.each(["/bonuses", "/bonuses/ads", "/bonuses/research"])("guest cannot open %s", async (path) => {
  localStorage.removeItem("cashback_token");
  mount(path);
  await waitFor(() => expect(window.location.pathname).toBe("/register"));
});

test.each(["/bonuses", "/bonuses/ads", "/bonuses/research"])("restored eligible users can open %s", async (path) => {
  eligible = true;
  mount(path);
  await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  expect(window.location.pathname).toBe(path);
  expect(screen.getByRole("heading")).toBeInTheDocument();
});

test("home does not navigate prematurely while restoring", async () => {
  let resolve!: (value: Response) => void;
  fetchMock.mockImplementationOnce(() => new Promise<Response>((done) => { resolve = done; }));
  mount();
  const button = screen.getByRole("button", { name: "Get bonuses" });
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(window.location.pathname).toBe("/");
  await act(async () => { resolve(response({ ...user, bonusEligible: true })); });
  expect(button).toBeEnabled();
  expect(screen.getByText(translations.EN.bonusReady)).toBeInTheDocument();
});

test("malformed successful save does not grant eligibility or navigate", async () => {
  const dialog = await openModal();
  fill(dialog);
  fetchMock.mockImplementationOnce(async () => response({ bonusEligible: true }));
  fireEvent.click(within(dialog).getByRole("button", { name: translations.EN.onboarding.save }));
  expect(await within(dialog).findByRole("alert")).toHaveTextContent(translations.EN.onboarding.failure);
  expect(window.location.pathname).toBe("/profile");
});

test("auth rejection after save never grants readiness to a rejected session", async () => {
  const dialog = await openModal();
  fill(dialog);
  fetchMock
    .mockImplementationOnce(async () => response(saved))
    .mockImplementationOnce(async () => response({ message: "private error" }, false, 401));
  fireEvent.click(within(dialog).getByRole("button", { name: translations.EN.onboarding.save }));
  expect(await within(dialog).findByRole("alert")).toHaveTextContent(translations.EN.onboarding.savedSessionUnavailable);
  expect(within(dialog).getByLabelText(translations.EN.onboarding.holder)).toHaveValue("");
  expect(within(dialog).getByLabelText(translations.EN.onboarding.sortCode)).toHaveValue("");
  expect(within(dialog).getByLabelText(translations.EN.onboarding.account)).toHaveValue("");
  expect(screen.getByText(translations.EN.bonusNotReady)).toBeInTheDocument();
  expect(window.location.pathname).toBe("/profile");
});

test("validated save with a network-failed profile refresh closes modal and opens ready home", async () => {
  const dialog = await openModal();
  fill(dialog);
  fetchMock
    .mockImplementationOnce(async () => response(saved))
    .mockRejectedValueOnce(new TypeError("Network unavailable"));
  fireEvent.click(within(dialog).getByRole("button", { name: translations.EN.onboarding.save }));
  await waitFor(() => expect(window.location.pathname).toBe("/"));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByText(translations.EN.bonusReady)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Get bonuses" }));
  expect(window.location.pathname).toBe("/bonuses");
});

test("StrictMode modal can save after effect cleanup and replay", async () => {
  window.history.replaceState({}, "", "/profile");
  render(<React.StrictMode><App /></React.StrictMode>);
  const button = await screen.findByRole("button", { name: translations.EN.onboarding.join });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  const dialog = screen.getByRole("dialog");
  fill(dialog);
  fireEvent.click(within(dialog).getByRole("button", { name: translations.EN.onboarding.save }));
  await waitFor(() => expect(window.location.pathname).toBe("/"));
  expect(screen.getByText(translations.EN.bonusReady)).toBeInTheDocument();
  expect(posts()[0][1].signal.aborted).toBe(true);
});

test.each(["/privacy", "/programme"])("draft route %s renders real policy content", (path) => {
  localStorage.removeItem("cashback_token");
  mount(path);
  expect(screen.getByText(translations.EN.onboarding.draft)).toBeInTheDocument();
  expect(screen.getByText(path === "/privacy" ? translations.EN.onboarding.privacyBody : translations.EN.onboarding.termsBody)).toBeInTheDocument();
});

test("new translation keys are consistent across all four languages", () => {
  for (const dictionary of Object.values(translations)) {
    expect(Object.keys(dictionary).sort()).toEqual(Object.keys(translations.EN).sort());
    expect(Object.keys(dictionary.onboarding).sort()).toEqual(Object.keys(translations.EN.onboarding).sort());
    expect(Object.values(dictionary.onboarding).every((value) => value.length > 0)).toBe(true);
  }
});
