import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Link, MemoryRouter, useLocation } from "react-router-dom";
import { AppRoutes } from "./App";
import { useAuth } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";
import Profile, { messages } from "./pages/Profile";
import Welcome from "./pages/Welcome";
import {
  emptyWiseForm,
  enrollmentKey,
  enrollInProgram,
  getOnboardingMessages,
  readOnboarding,
  saveCredentials,
  wiseKey,
} from "./onboarding";

jest.mock("./context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("./components/Header", () => () => null);
jest.mock("./components/CookieConsent", () => () => null);

const mockedUseAuth = useAuth as jest.Mock;
const user = { id: 101, name: "Demo User", email: "demo@example.com" };
const form = {
  fullName: "Demo User",
  email: "demo@example.com",
  wiseEmail: "wise@example.com",
  currency: "GBP",
  accountType: "Business",
};

function auth(currentUser: unknown = user, loading = false) {
  mockedUseAuth.mockReturnValue({ user: currentUser, loading, token: null });
}

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

function routeTree(path: string) {
  return (
    <LanguageProvider>
      <MemoryRouter initialEntries={[path]}>
        <Link to="/bonuses">Bonus entry</Link>
        <AppRoutes />
        <Location />
      </MemoryRouter>
    </LanguageProvider>
  );
}

function renderWelcome(lang = "en", withProfile = false) {
  return render(
    <LanguageProvider>
      <MemoryRouter>
        <Welcome lang={lang} />
        {withProfile && <Profile />}
        <Location />
      </MemoryRouter>
    </LanguageProvider>
  );
}

function fillForm() {
  for (const field of Object.keys(form) as (keyof typeof form)[]) {
    fireEvent.change(screen.getByLabelText(messages.en[field]), {
      target: { value: form[field] },
    });
  }
}

function seed(
  saved: unknown,
  enrolled: unknown = {
    userId: user.id,
    enrolledAt: "2026-10-06T10:30:00Z",
  }
) {
  localStorage.setItem(
    wiseKey,
    typeof saved === "string" ? saved : JSON.stringify(saved)
  );
  localStorage.setItem(enrollmentKey, JSON.stringify(enrolled));
}

const saved = { ...form, userId: user.id, savedAt: "2026-10-06T10:30:00Z" };

beforeEach(() => {
  localStorage.clear();
  auth();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => [],
  }) as typeof fetch;
});

afterEach(() => jest.restoreAllMocks());

test.each([
  ["empty", null],
  ["partial", { userId: user.id, fullName: form.fullName }],
  ["invalid email", { ...saved, wiseEmail: "bad" }],
  ["invalid currency", { ...saved, currency: "CAD" }],
  ["invalid account type", { ...saved, accountType: "Other" }],
  ["non-string field", { ...saved, email: 42 }],
  ["missing saved marker", { ...saved, savedAt: undefined }],
  ["invalid saved marker", { ...saved, savedAt: "bad" }],
  ["corrupt JSON", "not-json"],
  ["array", []],
  ["other owner", { ...saved, userId: 102 }],
  ["no owner", { ...saved, userId: undefined }],
])(
  "%s credentials fail closed despite an old enrollment",
  (_name, data) => {
    seed(data);
    renderWelcome();
    const button = screen.getByRole("button", { name: "Get bonuses" });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(
      getOnboardingMessages("en").explanation
    );
    fireEvent.click(button);
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/$/);
    expect(readOnboarding(user.id).eligible).toBe(false);
  }
);

test.each([undefined, null, 0, -1, NaN, Infinity, 1.5, "101"])(
  "invalid user identity %p cannot save or access bonuses",
  (id) => {
    seed(
      { ...saved, userId: id },
      { userId: id, enrolledAt: saved.savedAt }
    );
    auth({ ...user, id });
    renderWelcome();
    expect(screen.getByRole("button", { name: "Get bonuses" })).toBeDisabled();
    expect(() => saveCredentials(id, form)).toThrow();
    expect(() => enrollInProgram(id)).toThrow();
  }
);

test("unsaved typing, save and explicit enrollment update Welcome immediately", () => {
  renderWelcome("en", true);
  fillForm();
  expect(screen.getByRole("button", { name: "Get bonuses" })).toBeDisabled();
  expect(
    screen.getByRole("button", { name: messages.en.enroll })
  ).toBeDisabled();
  fireEvent.click(
    screen.getByRole("button", { name: messages.en.saveCredentials })
  );
  expect(readOnboarding(user.id).credentialsSaved).toBe(true);
  expect(localStorage.getItem(enrollmentKey)).toBeNull();
  expect(screen.getByRole("button", { name: "Get bonuses" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: messages.en.enroll }));
  expect(screen.getByRole("button", { name: "Get bonuses" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Get bonuses" }));
  expect(screen.getByTestId("location")).toHaveTextContent("/bonuses");
  expect(global.fetch).not.toHaveBeenCalled();
});

test.each(["en", "ru", "de", "fr"])(
  "localized %s explanation has a working profile link",
  (lang) => {
    renderWelcome(lang);
    const t = getOnboardingMessages(lang);
    expect(screen.getByText(t.explanation)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: t.profile });
    expect(link).toHaveAttribute("href", "/profile");
    fireEvent.click(link);
    expect(screen.getByTestId("location")).toHaveTextContent("/profile");
  }
);

test.each(["/bonuses", "/bonuses/ads", "/bonuses/research"])(
  "direct %s loads bonus page without auth or program enrollment",
  (path) => {
    render(routeTree(path));
    expect(screen.getByTestId("location")).toHaveTextContent(path);
    expect(
      screen.getByRole("heading", { name: "Get bonuses" })
    ).toBeInTheDocument();
  }
);

test("page load and link navigation both work for bonus pages", () => {
  render(routeTree("/"));
  fireEvent.click(screen.getByRole("link", { name: "Bonus entry" }));
  expect(screen.getByTestId("location")).toHaveTextContent("/bonuses");
  expect(
    screen.getByRole("heading", { name: "Get bonuses" })
  ).toBeInTheDocument();
});

test("button handler rechecks storage even before a storage event updates the UI", () => {
  seed(saved);
  renderWelcome();
  localStorage.removeItem(wiseKey);
  fireEvent.click(screen.getByRole("button", { name: "Get bonuses" }));
  expect(screen.getByTestId("location")).toHaveTextContent(/^\/$/);
});

test("invalid old enrollment leaves form editable and requires fresh enrollment after repair", () => {
  saveCredentials(user.id, form);
  enrollInProgram(user.id);
  const enrolled = readOnboarding(user.id);
  expect(enrolled.eligible).toBe(true);

  localStorage.setItem(wiseKey, JSON.stringify({ ...saved, email: "bad" }));
  const corrupted = readOnboarding(user.id);
  expect(corrupted.eligible).toBe(false);

  renderWelcome("en", true);
  expect(screen.getByLabelText(messages.en.fullName)).not.toHaveAttribute(
    "readonly"
  );
  fillForm();
  fireEvent.click(
    screen.getByRole("button", { name: messages.en.saveCredentials })
  );
  expect(screen.getByRole("button", { name: "Get bonuses" })).toBeDisabled();
  expect(
    screen.getByRole("button", { name: messages.en.enroll })
  ).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: messages.en.enroll }));
  expect(screen.getByRole("button", { name: "Get bonuses" })).toBeEnabled();
});

test("corrupt enrollment can be repaired by saving credentials and explicitly enrolling", () => {
  localStorage.setItem(enrollmentKey, "corrupt");
  renderWelcome("en", true);
  fillForm();
  fireEvent.click(
    screen.getByRole("button", { name: messages.en.saveCredentials })
  );
  expect(screen.getByRole("button", { name: "Get bonuses" })).toBeDisabled();
  expect(
    screen.getByRole("button", { name: messages.en.enroll })
  ).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: messages.en.enroll }));
  expect(screen.getByRole("button", { name: "Get bonuses" })).toBeEnabled();
});

test("account switch, logout and return never inherit eligibility", () => {
  seed(saved);
  const view = render(routeTree("/bonuses"));
  expect(screen.getByTestId("location")).toHaveTextContent("/bonuses");

  auth({ ...user, id: 102 });
  view.rerender(routeTree("/bonuses"));
  expect(screen.getByTestId("location")).toHaveTextContent("/bonuses");
  expect(readOnboarding(102).eligible).toBe(false);

  auth(null);
  view.rerender(routeTree("/bonuses"));
  expect(screen.getByTestId("location")).toHaveTextContent("/bonuses");

  auth();
  view.rerender(routeTree("/bonuses"));
  expect(readOnboarding(user.id).eligible).toBe(true);
  expect(readOnboarding(102).eligible).toBe(false);
});

test("scoped records take precedence over stale unscoped records from another account", () => {
  saveCredentials(user.id, form);
  enrollInProgram(user.id);
  seed(
    { ...saved, userId: 102 },
    { userId: 102, enrolledAt: saved.savedAt }
  );
  expect(readOnboarding(user.id).eligible).toBe(true);
  expect(readOnboarding(103).eligible).toBe(false);
  localStorage.setItem(`${wiseKey}:${user.id}`, "corrupt");
  expect(readOnboarding(user.id).eligible).toBe(false);
});

test("repairing one user's scoped data never removes another user's enrollment", () => {
  localStorage.setItem(
    enrollmentKey,
    JSON.stringify({ userId: 102, enrolledAt: saved.savedAt })
  );
  localStorage.setItem(
    `${enrollmentKey}:${user.id}`,
    JSON.stringify({ userId: user.id, enrolledAt: saved.savedAt })
  );
  saveCredentials(user.id, form);
  expect(JSON.parse(localStorage.getItem(enrollmentKey)!).userId).toBe(102);
  expect(readOnboarding(user.id).eligible).toBe(false);
});

test("relevant storage changes update the form and button state", () => {
  seed(saved);
  renderWelcome();
  act(() => {
    localStorage.removeItem(wiseKey);
    window.dispatchEvent(new StorageEvent("storage", { key: wiseKey }));
  });
  expect(screen.getByLabelText(messages.en.fullName)).toHaveValue("");
  expect(screen.getByRole("button", { name: "Get bonuses" })).toBeDisabled();
});

test("storage clearing and enrollment changes update already mounted Welcome", () => {
  renderWelcome();
  act(() => saveCredentials(user.id, form));
  expect(screen.getByRole("button", { name: "Get bonuses" })).toBeDisabled();
  act(() => enrollInProgram(user.id));
  expect(screen.getByRole("button", { name: "Get bonuses" })).toBeEnabled();
  act(() => {
    localStorage.clear();
    window.dispatchEvent(new StorageEvent("storage", { key: null }));
  });
  expect(screen.getByRole("button", { name: "Get bonuses" })).toBeDisabled();
});

test("read failures and save/enrollment write failures fail closed and are recoverable", () => {
  seed(saved);
  const getItem = jest
    .spyOn(Storage.prototype, "getItem")
    .mockImplementation(() => {
      throw new Error("Storage denied");
    });
  expect(readOnboarding(user.id).eligible).toBe(false);
  expect(() => enrollInProgram(user.id)).toThrow();
  getItem.mockRestore();
  localStorage.clear();
  renderWelcome("en", true);
  fillForm();
  const setItem = jest
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new Error("Storage full");
    });
  fireEvent.click(
    screen.getByRole("button", { name: messages.en.saveCredentials })
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    messages.en.storageError
  );
  expect(screen.getByRole("button", { name: "Get bonuses" })).toBeDisabled();
  setItem.mockRestore();
  fireEvent.click(
    screen.getByRole("button", { name: messages.en.saveCredentials })
  );
  const failEnrollment = jest
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(() => {
      throw new Error("Storage full");
    });
  fireEvent.click(screen.getByRole("button", { name: messages.en.enroll }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    messages.en.storageError
  );
  expect(screen.getByRole("button", { name: "Get bonuses" })).toBeDisabled();
  failEnrollment.mockRestore();
  fireEvent.click(screen.getByRole("button", { name: messages.en.enroll }));
  expect(screen.getByRole("button", { name: "Get bonuses" })).toBeEnabled();
});

test("partial enrollment write rolls back and does not survive refresh", () => {
  saveCredentials(user.id, form);
  const original = Storage.prototype.setItem;
  jest
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(function (
      this: Storage,
      key: string,
      value: string
    ) {
      if (key === enrollmentKey) throw new Error("Storage full");
      original.call(this, key, value);
    });
  expect(() => enrollInProgram(user.id)).toThrow();
  expect(localStorage.getItem(`${enrollmentKey}:${user.id}`)).toBeNull();
  expect(readOnboarding(user.id).eligible).toBe(false);
  renderWelcome();
  expect(screen.getByRole("button", { name: "Get bonuses" })).toBeDisabled();
});

test("invalid form cannot be saved or enrolled through helper calls", () => {
  expect(() => saveCredentials(user.id, emptyWiseForm)).toThrow();
  expect(() => enrollInProgram(user.id)).toThrow();
});