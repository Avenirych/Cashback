import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../context/AuthContext";
import { enrollmentKey, readOnboarding, wiseKey } from "../onboarding";
import Register from "./Register";
import Welcome from "./Welcome";

test("registration with accepted terms creates a session, not program enrollment", async () => {
  localStorage.clear();
  const user = { id: 201, name: "New Demo", email: "new@example.com" };
  global.fetch = jest.fn().mockResolvedValue({
    ok: true, text: async () => JSON.stringify({ access_token: "demo-session", user }),
  }) as typeof fetch;
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/register"]}>
        <Routes>
          <Route path="/register" element={<Register lang="EN" onLangChange={() => {}} />} />
          <Route path="/" element={<Welcome lang="EN" />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
  fireEvent.change(screen.getByPlaceholderText("Name"), { target: { value: user.name } });
  fireEvent.change(screen.getByPlaceholderText("Email"), { target: { value: user.email } });
  fireEvent.change(screen.getByPlaceholderText("Password (min 3 characters)"), {
    target: { value: "demo-password" },
  });
  expect(screen.getByRole("button", { name: "Register" })).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Register" }));
  expect(await screen.findByRole("button", { name: "Get bonuses" })).toBeDisabled();
  expect(localStorage.getItem("cashback_token")).toBe("demo-session");
  expect(localStorage.getItem(wiseKey)).toBeNull();
  expect(localStorage.getItem(enrollmentKey)).toBeNull();
  expect(readOnboarding(user.id).eligible).toBe(false);
  expect(screen.getByRole("link", { name: "Complete onboarding in Profile" }))
    .toHaveAttribute("href", "/profile");
});
