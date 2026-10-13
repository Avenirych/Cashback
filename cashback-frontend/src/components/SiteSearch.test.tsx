import React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import SiteSearch from "./SiteSearch";

const mockNavigate = jest.fn();
let mockLanguage = "en";
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));
jest.mock("../context/LanguageContext", () => ({
  useLang: () => ({ lang: mockLanguage, setLang: jest.fn() }),
}));

type Entry = { path: unknown; title: string; titleEn: string; text: string };
const entry = (path: unknown, text = ""): Entry => ({
  path, title: "Конфиденциальность", titleEn: "Privacy policy", text,
});
const originalFetch = global.fetch;
let mockFetch: jest.Mock;

beforeEach(() => {
  mockLanguage = "en";
  mockNavigate.mockReset();
  mockFetch = jest.fn();
  global.fetch = mockFetch;
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

// Flush the controlled response and its promise chain without timers or real HTTP.
async function mount(data: unknown = [], language = "en") {
  mockLanguage = language;
  mockFetch.mockResolvedValue({ ok: true, json: async () => data });
  const view = render(<SiteSearch />);
  await act(async () => { await mockFetch.mock.results[0].value; });
  return view;
}
function search(query: string) {
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: query } });
}
function result(path: string) {
  const label = screen.getByText(path, { selector: "small" });
  const button = label.closest("button");
  if (!button) throw new Error("Result has no navigation button");
  return button;
}

const localizedCases = [
  ["ru", "Конфиденциальность", "/privacy", "Конфиденциальность"],
  ["en", "Privacy", "/privacy", "Privacy policy"],
  ["de", "Datenschutz", "/privacy", "Datenschutz"],
  ["de", "Nutzungsbedingungen", "/terms", "Nutzungsbedingungen"],
  ["fr", "Confidentialité", "/privacy", "Confidentialité"],
  ["de", "Über uns", "/about", "Über uns"],
  ["fr", "À propos", "/about", "À propos"],
];
describe.each(["loaded index", "fallback"])("localization with %s", source => {
  test.each(localizedCases)("%s query %s reaches %s and displays %s", async (lang, query, path, title) => {
    await mount(source === "loaded index" ? [entry(path)] : [], lang);
    search(query);
    expect(within(result(path)).getByText(title, { selector: "span" })).toBeInTheDocument();
    fireEvent.click(result(path));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith(path);
    expect(screen.getByRole("searchbox")).toHaveValue("");
  });
});

test.each(["ru", "en", "de", "fr"])("English titles remain searchable in %s", async lang => {
  await mount([entry("/privacy")], lang);
  search("Privacy policy");
  expect(result("/privacy")).toBeInTheDocument();
});

test.each([
  ["de", "/product-offers", "Product offers"],
  ["fr", "/product-offers", "Product offers"],
  ["de", "/forum/rules", "Forum rules"],
  ["fr", "/forum/rules", "Forum rules"],
])("%s uses English fallback for untranslated %s", async (lang, path, title) => {
  await mount([{ path, title: "Русское название", titleEn: title, text: "" }], lang);
  search(title);
  expect(within(result(path)).getByText(title, { selector: "span" })).toBeInTheDocument();
});

test("loads index using an abort signal and searches indexed content", async () => {
  await mount([entry("/privacy", "uniquelyindexedword")]);
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(mockFetch).toHaveBeenCalledWith(expect.stringMatching(/\/search-index\.json$/), {
    signal: expect.any(AbortSignal), cache: "no-cache",
  });
  search("uniquelyindexedword");
  expect(result("/privacy")).toBeInTheDocument();
});

test("merges duplicate indexed paths and fallback into one result", async () => {
  await mount([entry("/privacy", "oldindexedword"), entry("/privacy", "latestindexedword")]);
  search("privacy");
  expect(screen.getAllByText("/privacy", { selector: "small" })).toHaveLength(1);
  search("latestindexedword");
  expect(result("/privacy")).toBeInTheDocument();
  search("личные данные");
  expect(result("/privacy")).toBeInTheDocument();
});

test.each(["HTTP", "invalid JSON", "invalid structure", "network"])("%s failure preserves fallback", async failure => {
  if (failure === "HTTP") mockFetch.mockResolvedValue({ ok: false, status: 503 });
  if (failure === "invalid JSON") mockFetch.mockResolvedValue({ ok: true, json: async () => { throw new SyntaxError("Synthetic malformed JSON"); } });
  if (failure === "invalid structure") mockFetch.mockResolvedValue({ ok: true, json: async () => ({ pages: [] }) });
  if (failure === "network") mockFetch.mockRejectedValue(new Error("Synthetic network failure"));
  render(<SiteSearch />);
  await act(async () => { await mockFetch.mock.results[0].value.catch(() => undefined); });
  expect(console.warn).toHaveBeenCalledWith("Search index unavailable; using section search.", expect.any(Error));
  search("Privacy");
  fireEvent.click(result("/privacy"));
  expect(mockNavigate).toHaveBeenCalledWith("/privacy");
});

test.each(["", "   "])("empty query %p has no results and does not navigate", async query => {
  await mount();
  fireEvent.focus(screen.getByRole("searchbox"));
  search(query);
  expect(screen.queryByText("No results found")).not.toBeInTheDocument();
  expect(screen.queryByText("/privacy", { selector: "small" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
  expect(mockNavigate).not.toHaveBeenCalled();
});

test.each([
  ["ru", "Ничего не найдено"], ["en", "No results found"],
  ["de", "Keine Ergebnisse"], ["fr", "Aucun résultat"],
])("%s displays localized empty results", async (lang, message) => {
  await mount([], lang);
  search("impossiblesyntheticquery");
  expect(screen.getByText(message)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Поиск|Search|Suche|Rechercher/ }));
  expect(mockNavigate).not.toHaveBeenCalled();
});

test("unmount aborts the pending index request and ignores its late response", async () => {
  let resolveResponse!: (value: unknown) => void;
  const pending = new Promise(resolve => { resolveResponse = resolve; });
  mockFetch.mockReturnValue(pending);
  const view = render(<SiteSearch />);
  const signal = mockFetch.mock.calls[0][1].signal as AbortSignal;
  expect(signal.aborted).toBe(false);
  view.unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => {
    resolveResponse({ ok: true, json: async () => [entry("/privacy", "lateword")] });
    await pending;
  });
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(console.warn).not.toHaveBeenCalled();
  expect(screen.queryByRole("search")).not.toBeInTheDocument();
});

test.each([
  "https://external.example", "//external.example", "javascript:alert(1)",
  "data:text/html,synthetic", "/unknown-route", "", null, undefined, 7, {}, [],
  "/privacy?redirect=external", "/privacy#fragment", "/privacy/", " /privacy",
])("rejects unsafe or malformed indexed path %p", async path => {
  await mount([entry(path, "maliciousuniqueword"), entry("/privacy", "safeuniqueword")]);
  search("safeuniqueword");
  expect(result("/privacy")).toBeInTheDocument();
  search("maliciousuniqueword");
  expect(screen.getByText("No results found")).toBeInTheDocument();
  expect(screen.queryByText("/privacy", { selector: "small" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
  expect(mockNavigate).not.toHaveBeenCalled();
});

test("ignores malformed entry fields without losing valid entries", async () => {
  await mount([null, "invalid", { ...entry("/privacy"), title: 3 },
    { ...entry("/privacy"), titleEn: null }, { ...entry("/privacy"), text: [] },
    { path: "/privacy" }, entry("/about", "validuniqueword")]);
  search("validuniqueword");
  expect(result("/about")).toBeInTheDocument();
});

test("form submission navigates to the first allowed result", async () => {
  await mount();
  search("Datenschutz");
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
  expect(mockNavigate).toHaveBeenCalledTimes(1);
  expect(mockNavigate).toHaveBeenCalledWith("/privacy");
});

test("navigation rechecks the allowlist after a result was rendered", async () => {
  await mount([entry("/privacy")]);
  search("privacy");
  const button = result("/privacy");
  // Simulate allowlist rejection only at click time, exercising go() itself.
  const originalHas = Set.prototype.has;
  const has = jest.spyOn(Set.prototype, "has").mockImplementation(function (this: Set<unknown>, value: unknown) {
    return value === "/privacy" ? false : originalHas.call(this, value);
  });
  try {
    fireEvent.click(button);
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole("searchbox")).toHaveValue("privacy");
  } finally { has.mockRestore(); }
});

test("indexed markup is displayed as text rather than interpreted as HTML", async () => {
  const title = '<img src="synthetic" onerror="synthetic()">';
  await mount([{ path: "/product-offers", title, titleEn: title, text: "markupword" }]);
  search("markupword");
  expect(within(result("/product-offers")).getByText(title)).toBeInTheDocument();
  expect(within(result("/product-offers")).queryByRole("img")).not.toBeInTheDocument();
});

test.each([
  "/", "/about", "/services", "/shop", "/forum", "/bonuses", "/bonuses/ads",
  "/bonuses/research", "/faq", "/contacts", "/terms", "/privacy",
  "/product-offers", "/forum/rules",
])("permits indexed internal route %s", async path => {
  await mount([entry(path, "allowedrouteuniqueword")]);
  search("allowedrouteuniqueword");
  fireEvent.click(result(path));
  expect(mockNavigate).toHaveBeenCalledTimes(1);
  expect(mockNavigate).toHaveBeenCalledWith(path);
});
