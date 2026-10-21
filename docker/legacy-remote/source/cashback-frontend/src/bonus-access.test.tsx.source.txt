import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import { useAuth } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";

import Bonuses from "./pages/Bonuses";
import BonusAds from "./pages/BonusAds";
import BonusResearch from "./pages/BonusResearch";

import {
  enrollmentKey,
  wiseKey,
} from "./onboarding";

jest.mock("./context/AuthContext", () => ({
  useAuth: jest.fn(),
}));

const mockedUseAuth = useAuth as jest.Mock;

const user = {
  id: 101,
  name: "Demo User",
  email: "demo@example.com",
  email_verified: true,
};

const savedAt = "2026-10-06T10:30:00Z";

function mockAuth(
  overrides: Record<string, unknown> = {},
) {
  mockedUseAuth.mockReturnValue({
    user,
    token: "test-token",
    loading: false,
    ...overrides,
  });
}

function seedEligible(userId = user.id) {
  localStorage.setItem(
    wiseKey,
    JSON.stringify({
      userId,
      fullName: "Demo User",
      email: "demo@example.com",
      wiseEmail: "wise@example.com",
      currency: "GBP",
      accountType: "Business",
      savedAt,
    }),
  );

  localStorage.setItem(
    enrollmentKey,
    JSON.stringify({
      userId,
      enrolledAt: savedAt,
    }),
  );
}

function Location() {
  const location = useLocation();

  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
    </output>
  );
}

function TestRoutes() {
  return (
    <>
      <Routes>
        <Route path="/bonuses" element={<Bonuses />} />

        <Route
          path="/bonuses/ads"
          element={<BonusAds />}
        />

        <Route
          path="/bonuses/research"
          element={<BonusResearch />}
        />

        <Route
          path="/bonuses/research/:direction"
          element={<h1>Research destination</h1>}
        />

        <Route
          path="/register"
          element={<h1>Registration destination</h1>}
        />

        <Route
          path="/profile"
          element={<h1>Profile destination</h1>}
        />
      </Routes>

      <Location />
    </>
  );
}

function renderRoute(path: string) {
  return render(
    <LanguageProvider>
      <MemoryRouter initialEntries={[path]}>
        <TestRoutes />
      </MemoryRouter>
    </LanguageProvider>,
  );
}

const publicPages = [
  {
    path: "/bonuses",
    actionName: /^Watch ads$/,
  },
  {
    path: "/bonuses/ads",
    actionName: /^I agree to watch advertising$/,
  },
  {
    path: "/bonuses/research",
    actionName: /^Participate: 1\) Paid Surveys$/,
  },
];

const protectedActions = [
  {
    path: "/bonuses/ads",
    actionName: /^I agree to watch advertising$/,
    next: "/bonuses/ads",
  },
  {
    path: "/bonuses/research",
    actionName: /^Participate: 1\) Paid Surveys$/,
    next: "/bonuses/research/surveys",
  },
];

beforeEach(() => {
  localStorage.clear();
  mockAuth();

  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => [],
  }) as unknown as typeof fetch;
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe("Public bonus pages", () => {
  test.each(publicPages)(
    "guest can view $path",
    ({ path, actionName }) => {
      mockAuth({
        user: null,
        token: null,
      });

      renderRoute(path);

      expect(
        screen.getByTestId("location").textContent,
      ).toBe(path);

      expect(
        screen.getByRole("button", {
          name: actionName,
        }),
      ).toBeInTheDocument();

      expect(global.fetch).not.toHaveBeenCalled();
    },
  );

  test.each(publicPages)(
    "user without enrollment can view $path",
    ({ path, actionName }) => {
      renderRoute(path);

      expect(
        screen.getByTestId("location").textContent,
      ).toBe(path);

      expect(
        screen.getByRole("button", {
          name: actionName,
        }),
      ).toBeInTheDocument();
    },
  );

  test.each([
    {
      button: /^Watch ads$/,
      destination: "/bonuses/ads",
    },
    {
      button: /^Participate in research$/,
      destination: "/bonuses/research",
    },
  ])(
    "overview navigation to $destination does not require registration",
    ({ button, destination }) => {
      mockAuth({
        user: null,
        token: null,
      });

      renderRoute("/bonuses");

      fireEvent.click(
        screen.getByRole("button", {
          name: button,
        }),
      );

      expect(
        screen.getByTestId("location").textContent,
      ).toBe(destination);
    },
  );
});

describe.each(protectedActions)(
  "Protected action on $path",
  ({ path, actionName, next }) => {
    test("guest is sent to registration", () => {
      mockAuth({
        user: null,
        token: null,
      });

      renderRoute(path);

      fireEvent.click(
        screen.getByRole("button", {
          name: actionName,
        }),
      );

      expect(
        screen.getByTestId("location").textContent,
      ).toBe(
        `/register?next=${encodeURIComponent(next)}`,
      );
    });

    test("missing token prevents participation", () => {
      seedEligible();
      mockAuth({ token: null });

      renderRoute(path);

      fireEvent.click(
        screen.getByRole("button", {
          name: actionName,
        }),
      );

      expect(
        screen.getByTestId("location").textContent,
      ).toBe(
        `/register?next=${encodeURIComponent(next)}`,
      );
    });

    test("unverified email prevents participation", () => {
      seedEligible();

      mockAuth({
        user: {
          ...user,
          email_verified: false,
        },
      });

      renderRoute(path);

      fireEvent.click(
        screen.getByRole("button", {
          name: actionName,
        }),
      );

      expect(
        screen.getByTestId("location").textContent,
      ).toBe(
        `/register?next=${encodeURIComponent(next)}`,
      );
    });

    test("user without enrollment is sent to profile", () => {
      renderRoute(path);

      fireEvent.click(
        screen.getByRole("button", {
          name: actionName,
        }),
      );

      expect(
        screen.getByTestId("location").textContent,
      ).toBe("/profile");
    });

    test("invalid identity cannot participate", () => {
      mockAuth({
        user: {
          ...user,
          id: 0,
        },
      });

      renderRoute(path);

      fireEvent.click(
        screen.getByRole("button", {
          name: actionName,
        }),
      );

      expect(
        screen.getByTestId("location").textContent,
      ).toBe("/profile");
    });

    test("loading auth disables the action without redirecting", () => {
      mockAuth({
        user: null,
        token: null,
        loading: true,
      });

      renderRoute(path);

      // Во время загрузки текст кнопки локализован
      // как «Please wait…».
      const button = screen.getByRole("button", {
        name:
          path === "/bonuses/ads"
            ? /^Please wait…$/
            : actionName,
      });

      expect(button).toBeDisabled();

      fireEvent.click(button);

      expect(
        screen.getByTestId("location").textContent,
      ).toBe(path);
    });

    test("rechecks storage before action without waiting for a storage event", () => {
      seedEligible();

      // Для этого сценария кнопка рекламы остаётся
      // доступной без загрузки изображений: доступ
      // проверяется до попытки запуска плеера.
      if (path === "/bonuses/ads") {
        const imageSources: HTMLImageElement[] = [];

        jest
          .spyOn(
            HTMLImageElement.prototype,
            "src",
            "set",
          )
          .mockImplementation(function (
            this: HTMLImageElement,
            _value: string,
          ) {
            imageSources.push(this);
          });

        renderRoute(path);

        act(() => {
          imageSources.forEach((image) => {
            image.dispatchEvent(new Event("load"));
          });
        });
      } else {
        renderRoute(path);
      }

      localStorage.removeItem(wiseKey);

      const button = screen.getByRole("button", {
        name: actionName,
      });

      expect(button).toBeEnabled();

      fireEvent.click(button);

      expect(
        screen.getByTestId("location").textContent,
      ).toBe("/profile");
    });
  },
);

test("eligible user can open a selected research direction", () => {
  seedEligible();

  renderRoute("/bonuses/research");

  fireEvent.click(
    screen.getByRole("button", {
      name: /^Participate: 1\) Paid Surveys$/,
    }),
  );

  expect(
    screen.getByTestId("location").textContent,
  ).toBe("/bonuses/research/surveys");

  expect(
    screen.getByRole("heading", {
      name: "Research destination",
    }),
  ).toBeInTheDocument();
});