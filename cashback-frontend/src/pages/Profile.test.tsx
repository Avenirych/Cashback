import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
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
