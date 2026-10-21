import React from "react";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Profile, { formatBalance, getMessages, messages } from "./Profile";
import { useAuth } from "../context/AuthContext";
import { LanguageProvider, useLang } from "../context/LanguageContext";

jest.mock("../context/AuthContext", () => ({
  useAuth: jest.fn(),
}));

const mockedUseAuth = useAuth as jest.Mock;

function mockAuth(overrides: Record<string, unknown> = {}) {
  mockedUseAuth.mockReturnValue({
    user: null,
    token: null,
    loading: false,
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    ...overrides,
  });
}

let switchLang: (lang: string) => void = () => {};

function LangGrabber() {
  const { setLang } = useLang();
  switchLang = setLang;
  return null;
}

function renderProfile() {
  return render(
    <LanguageProvider>
      <LangGrabber />
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    </LanguageProvider>
  );
}

const testUser = { id: 1, email: "anna@example.com", name: "Anna", balance: 12.5 };

beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    json: () => Promise.resolve(null),
  }) as unknown as typeof fetch;
});

afterEach(() => {
  jest.resetAllMocks();
});

describe("Profile page", () => {
  test("shows loading state", () => {
    mockAuth({ loading: true });
    renderProfile();
    expect(screen.getByRole("status")).toHaveTextContent(messages.en.loading);
  });

  test("shows login and register links for guests", () => {
    mockAuth();
    renderProfile();
    expect(screen.getByRole("heading", { name: messages.en.guestTitle })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: messages.en.login })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: messages.en.register })).toHaveAttribute(
      "href",
      "/register"
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("displays authenticated user data, demo notice and navigation links", async () => {
    mockAuth({ user: testUser, token: "test-token" });
    renderProfile();

    expect(screen.getByRole("heading", { name: messages.en.title })).toBeInTheDocument();
    expect(screen.getByTestId("profile-name")).toHaveTextContent("Anna");
    expect(screen.getByTestId("profile-email")).toHaveTextContent("anna@example.com");
    expect(screen.getByTestId("profile-balance")).toHaveTextContent("12.50");
    expect(screen.getByRole("note")).toHaveTextContent(/demo/i);
    expect(screen.getByRole("link", { name: messages.en.home })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: messages.en.shop })).toHaveAttribute("href", "/shop");

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3001/auth/profile",
        expect.objectContaining({
          headers: { Authorization: "Bearer " + "test-token" },
        })
      )
    );
  });

  test("uses fresh data from /auth/profile when available", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ...testUser, balance: "99.10" }),
    });
    mockAuth({ user: testUser, token: "test-token" });
    renderProfile();

    await waitFor(() => expect(screen.getByTestId("profile-balance")).toHaveTextContent("99.10"));
  });

  test("keeps context data when the profile request fails", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("network"));
    mockAuth({ user: testUser, token: "test-token" });
    renderProfile();

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.getByTestId("profile-balance")).toHaveTextContent("12.50");
  });

  test.each([
    [{ ...testUser, balance: "15.75" }, "15.75"],
    [{ ...testUser, balance: NaN }, "0.00"],
    [{ ...testUser, balance: undefined }, "0.00"],
  ])("renders balance safely for %p", (user, expected) => {
    mockAuth({ user });
    renderProfile();
    expect(screen.getByTestId("profile-balance")).toHaveTextContent(expected);
  });

  test("updates labels when language changes", () => {
    mockAuth({ user: testUser });
    renderProfile();
    expect(screen.getByText(messages.en.balance)).toBeInTheDocument();

    act(() => switchLang("ru"));
    expect(screen.getByRole("heading", { name: messages.ru.title })).toBeInTheDocument();
    expect(screen.getByText(messages.ru.balance)).toBeInTheDocument();

    act(() => switchLang("de"));
    expect(screen.getByText(messages.de.balance)).toBeInTheDocument();

    act(() => switchLang("fr"));
    expect(screen.getByText(messages.fr.balance)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: messages.fr.shop })).toBeInTheDocument();
  });
});

describe("formatBalance", () => {
  test.each<[unknown, string]>([
    [10, "10.00"],
    [0, "0.00"],
    ["5.5", "5.50"],
    ["  ", "0.00"],
    ["abc", "0.00"],
    [NaN, "0.00"],
    [Infinity, "0.00"],
    [null, "0.00"],
    [undefined, "0.00"],
  ])("formatBalance(%p) === %p", (input, expected) => {
    expect(formatBalance(input)).toBe(expected);
  });
});

describe("getMessages", () => {
  test("falls back to English for unknown languages", () => {
    expect(getMessages("es")).toBe(messages.en);
    expect(getMessages(undefined)).toBe(messages.en);
    expect(getMessages("RU")).toBe(messages.ru);
  });
});

const wiseData = {
  fullName: "Anna Example",
  email: "anna@example.com",
  currency: "EUR",
  accountType: "Business",
  wiseEmail: "wise@example.com",
  savedAt: "2026-10-06T10:30:00Z",
  userId: testUser.id,
};

function fillWiseForm(overrides: Partial<typeof wiseData> = {}) {
  const data = { ...wiseData, ...overrides };
  const t = messages.en;
  fireEvent.change(screen.getByLabelText(t.fullName), { target: { value: data.fullName } });
  fireEvent.change(screen.getByLabelText(t.email), { target: { value: data.email } });
  fireEvent.change(screen.getByLabelText(t.wiseEmail), { target: { value: data.wiseEmail } });
  fireEvent.change(screen.getByLabelText(t.currency), { target: { value: data.currency } });
  fireEvent.change(screen.getByLabelText(t.accountType), { target: { value: data.accountType } });
}

function expectReadonlyCredentials() {
  expect(screen.getByLabelText(messages.en.fullName)).toHaveAttribute("readonly");
  expect(screen.getByLabelText(messages.en.email)).toHaveAttribute("readonly");
  expect(screen.getByLabelText(messages.en.wiseEmail)).toHaveAttribute("readonly");
  expect(screen.getByLabelText(messages.en.currency)).toBeDisabled();
  expect(screen.getByLabelText(messages.en.accountType)).toBeDisabled();
}

describe("Wise credentials and enrollment", () => {
  beforeEach(() => mockAuth({ user: testUser }));

  test("shows an empty form with disabled save and enrollment buttons", () => {
    renderProfile();
    expect(screen.getByLabelText(messages.en.fullName)).toHaveValue("");
    expect(screen.getByLabelText(messages.en.email)).toHaveValue("");
    expect(screen.getByLabelText(messages.en.wiseEmail)).toHaveValue("");
    expect(screen.getByLabelText(messages.en.currency)).toHaveValue("");
    expect(screen.getByLabelText(messages.en.accountType)).toHaveValue("");
    expect(screen.getByRole("button", { name: messages.en.saveCredentials })).toBeDisabled();
    expect(screen.getByRole("button", { name: messages.en.enroll })).toBeDisabled();
    expect(screen.getByText(messages.en.wiseNotice)).toBeInTheDocument();
  });

  test.each(["fullName", "email", "wiseEmail", "currency", "accountType"] as const)(
    "requires %s, including whitespace-only text",
    (field) => {
      renderProfile();
      fillWiseForm({ [field]: field === "currency" || field === "accountType" ? "" : "   " });
      expect(screen.getByLabelText(messages.en[field])).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByRole("alert")).toHaveTextContent(messages.en.required);
      expect(screen.getByRole("button", { name: messages.en.saveCredentials })).toBeDisabled();
      expect(screen.getByRole("button", { name: messages.en.enroll })).toBeDisabled();
      expect(localStorage.getItem("cashback_wise_data")).toBeNull();
    }
  );

  test.each([
    "not-an-email", "anna@", "@example.com", "anna@example", "anna @example.com",
    "anna@example..com",
  ])("rejects invalid email format: %s", (email) => {
    renderProfile();
    fillWiseForm({ email, wiseEmail: email });
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    screen.getAllByRole("alert").forEach((error) =>
      expect(error).toHaveTextContent(messages.en.invalidEmail)
    );
    expect(screen.getByRole("button", { name: messages.en.saveCredentials })).toBeDisabled();
    expect(screen.getByRole("button", { name: messages.en.enroll })).toBeDisabled();
  });

  test("shows errors on blur and prevents invalid form submission", () => {
    const { container } = renderProfile();
    fireEvent.blur(screen.getByLabelText(messages.en.fullName));
    expect(screen.getAllByRole("alert")).toHaveLength(5);
    fireEvent.submit(container.querySelector("form")!);
    expect(localStorage.getItem("cashback_wise_data")).toBeNull();
  });

  test("saves valid trimmed credentials locally, then enables enrollment", () => {
    renderProfile();
    fillWiseForm({ fullName: " Anna Example ", email: " anna@example.com " });
    const save = screen.getByRole("button", { name: messages.en.saveCredentials });
    expect(save).toBeEnabled();
    expect(screen.getByRole("button", { name: messages.en.enroll })).toBeDisabled();
    fireEvent.click(save);

    const saved = JSON.parse(localStorage.getItem("cashback_wise_data")!);
    expect(saved).toEqual({
      ...wiseData,
      savedAt: expect.any(String),
      userId: testUser.id,
    });
    expect(Number.isFinite(Date.parse(saved.savedAt))).toBe(true);
    expect(screen.getByRole("status")).toHaveTextContent(messages.en.credentialsSaved);
    expectReadonlyCredentials();
    expect(screen.queryByRole("button", { name: messages.en.saveCredentials })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: messages.en.enroll })).toBeEnabled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("restores saved credentials in readonly mode for an unenrolled user", () => {
    localStorage.setItem("cashback_wise_data", JSON.stringify(wiseData));
    renderProfile();
    expectReadonlyCredentials();
    expect(screen.getByLabelText(messages.en.fullName)).toHaveValue(wiseData.fullName);
    expect(screen.getByLabelText(messages.en.currency)).toHaveValue(wiseData.currency);
    expect(screen.getByRole("button", { name: messages.en.enroll })).toBeEnabled();
  });

  test("enrollment shows confirmation and date, and survives a page remount", () => {
    const { unmount } = renderProfile();
    fillWiseForm();
    fireEvent.click(screen.getByRole("button", { name: messages.en.saveCredentials }));
    fireEvent.click(screen.getByRole("button", { name: messages.en.enroll }));

    const { enrolledAt } = JSON.parse(localStorage.getItem("cashback_program_enrolled")!);
    expect(Number.isFinite(Date.parse(enrolledAt))).toBe(true);
    expect(screen.getByRole("status")).toHaveTextContent(messages.en.enrolled);
    expect(screen.getByRole("status")).toHaveTextContent(messages.en.enrollmentDate);
    expect(screen.getByText(new Date(enrolledAt).toLocaleDateString("en"))).toHaveAttribute(
      "datetime", enrolledAt
    );
    expectReadonlyCredentials();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    unmount();
    renderProfile();
    expectReadonlyCredentials();
    expect(screen.getByLabelText(messages.en.wiseEmail)).toHaveValue(wiseData.wiseEmail);
    expect(screen.getByRole("status")).toHaveTextContent(messages.en.enrolled);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("restores enrollment and readonly credentials from localStorage", () => {
    localStorage.setItem("cashback_wise_data", JSON.stringify(wiseData));
    localStorage.setItem("cashback_program_enrolled", JSON.stringify({
      userId: testUser.id, enrolledAt: wiseData.savedAt,
    }));
    renderProfile();
    expectReadonlyCredentials();
    expect(screen.getByRole("status")).toHaveTextContent(messages.en.enrolled);
    expect(screen.getByText(new Date(wiseData.savedAt).toLocaleDateString("en"))).toHaveAttribute(
      "datetime", wiseData.savedAt
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  test("saved credentials persist before enrollment", () => {
    const { unmount } = renderProfile();
    fillWiseForm();
    fireEvent.click(screen.getByRole("button", { name: messages.en.saveCredentials }));
    unmount();
    renderProfile();
    expectReadonlyCredentials();
    expect(screen.getByRole("button", { name: messages.en.enroll })).toBeEnabled();
    expect(screen.getByLabelText(messages.en.email)).toHaveValue(wiseData.email);
  });

  test.each(["invalid-json", "null", "[]", JSON.stringify({ ...wiseData, email: "bad" }),
    JSON.stringify({ ...wiseData, currency: "CAD", accountType: "Other" })])(
    "does not allow enrollment with malformed or invalid stored credentials: %s",
    (raw) => {
      localStorage.setItem("cashback_wise_data", raw);
      localStorage.setItem("cashback_program_enrolled", JSON.stringify({ enrolledAt: "invalid-date" }));
      renderProfile();
      expect(screen.getByRole("button", { name: messages.en.enroll })).toBeDisabled();
      expect(screen.getByRole("button", { name: messages.en.saveCredentials })).toBeDisabled();
      expect(screen.getByLabelText(messages.en.fullName)).not.toHaveAttribute("readonly");
    }
  );

  test("keeps each user's credentials and enrollment separate on account switches", () => {
    const view = renderProfile();
    fillWiseForm();
    fireEvent.click(screen.getByRole("button", { name: messages.en.saveCredentials }));
    fireEvent.click(screen.getByRole("button", { name: messages.en.enroll }));

    mockAuth({ user: { ...testUser, id: 2 } });
    view.rerender(
      <LanguageProvider><MemoryRouter><Profile /></MemoryRouter></LanguageProvider>
    );
    expect(screen.getByLabelText(messages.en.fullName)).toHaveValue("");
    expect(screen.getByRole("button", { name: messages.en.enroll })).toBeDisabled();
    fillWiseForm({ fullName: "Second User" });
    fireEvent.click(screen.getByRole("button", { name: messages.en.saveCredentials }));

    mockAuth({ user: testUser });
    view.rerender(
      <LanguageProvider><MemoryRouter><Profile /></MemoryRouter></LanguageProvider>
    );
    expect(screen.getByLabelText(messages.en.fullName)).toHaveValue(wiseData.fullName);
    expect(screen.getByRole("status")).toHaveTextContent(messages.en.enrolled);
  });

  test("does not expose unowned credentials or enrollment to authenticated accounts", () => {
    localStorage.setItem("cashback_wise_data", JSON.stringify({ ...wiseData, userId: undefined }));
    localStorage.setItem("cashback_program_enrolled", JSON.stringify({ enrolledAt: wiseData.savedAt }));
    renderProfile();
    expect(screen.getByLabelText(messages.en.fullName)).toHaveValue("");
    expect(screen.getByRole("button", { name: messages.en.enroll })).toBeDisabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  test("reports storage failures without claiming credentials were saved or enrolling", () => {
    renderProfile();
    fillWiseForm();
    const setItem = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });
    try {
      fireEvent.click(screen.getByRole("button", { name: messages.en.saveCredentials }));
      expect(screen.getByRole("alert")).toHaveTextContent(messages.en.storageError);
      expect(screen.getByRole("button", { name: messages.en.enroll })).toBeDisabled();
      expect(screen.getByLabelText(messages.en.fullName)).not.toHaveAttribute("readonly");
    } finally {
      setItem.mockRestore();
    }
  });

  test("rolls back the account copy if saving the main storage key fails", () => {
    const { unmount } = renderProfile();
    fillWiseForm();
    const originalSetItem = Storage.prototype.setItem;
    const setItem = jest.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage, key: string, value: string
    ) {
      if (key === "cashback_wise_data") throw new Error("storage full");
      originalSetItem.call(this, key, value);
    });
    try {
      fireEvent.click(screen.getByRole("button", { name: messages.en.saveCredentials }));
      expect(screen.getByRole("alert")).toHaveTextContent(messages.en.storageError);
      expect(localStorage.getItem(`cashback_wise_data:${testUser.id}`)).toBeNull();
      unmount();
      renderProfile();
      expect(screen.getByRole("button", { name: messages.en.enroll })).toBeDisabled();
    } finally {
      setItem.mockRestore();
    }
  });

  test("translates every label, option, validation message, saved and enrolled status", () => {
    renderProfile();
    fillWiseForm({ email: "invalid", wiseEmail: "" });
    for (const lang of ["ru", "de", "fr", "en"] as const) {
      act(() => switchLang(lang));
      const t = messages[lang];
      expect(screen.getByRole("group", { name: t.wiseCredentials })).toBeInTheDocument();
      for (const field of ["fullName", "email", "wiseEmail", "currency", "accountType"] as const) {
        expect(screen.getByLabelText(t[field])).toBeInTheDocument();
      }
      expect(screen.getByRole("option", { name: t.personal })).toHaveValue("Personal");
      expect(screen.getByRole("option", { name: t.business })).toHaveValue("Business");
      for (const currency of ["EUR", "GBP", "USD"]) {
        expect(screen.getByRole("option", { name: currency })).toHaveValue(currency);
      }
      expect(screen.getByRole("button", { name: t.saveCredentials })).toBeDisabled();
      expect(screen.getByRole("button", { name: t.enroll })).toBeDisabled();
      expect(screen.getByText(t.required)).toBeInTheDocument();
      expect(screen.getByText(t.invalidEmail)).toBeInTheDocument();
      expect(screen.getByText(t.wiseNotice)).toBeInTheDocument();
    }
    fillWiseForm();
    fireEvent.click(screen.getByRole("button", { name: messages.en.saveCredentials }));
    for (const lang of ["ru", "de", "fr", "en"] as const) {
      act(() => switchLang(lang));
      expect(screen.getByRole("status")).toHaveTextContent(messages[lang].credentialsSaved);
      expect(screen.getByRole("button", { name: messages[lang].enroll })).toBeEnabled();
    }
    fireEvent.click(screen.getByRole("button", { name: messages.en.enroll }));
    for (const lang of ["ru", "de", "fr", "en"] as const) {
      act(() => switchLang(lang));
      expect(screen.getByRole("status")).toHaveTextContent(messages[lang].enrolled);
      expect(screen.getByRole("status")).toHaveTextContent(messages[lang].enrollmentDate);
    }
  });
});
