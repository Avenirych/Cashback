import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { enrollmentKey, readOnboarding, wiseKey } from "../onboarding";
import Register from "./Register";
import Welcome from "./Welcome";

function RegistrationState() {
  const { user, isEmailVerificationPending } = useAuth();
  const location = useLocation();
  return <output data-testid="registration-state">{JSON.stringify({
    pathname: location.pathname, userId: user?.id ?? null, pending: isEmailVerificationPending,
  })}</output>;
}

test("registration with accepted terms creates a pending session, not program enrollment", async () => {
  localStorage.clear();
  sessionStorage.clear();
  const user = { id: 201, name: "Synthetic Registration", email: "registration@example.test", email_verified: false };
  const response = { access_token: "synthetic-session", user, verification_email_sent: true,
    message: "Registration successful. Please check your email to verify your account." };
  global.fetch = jest.fn().mockResolvedValue({
    ok: true, text: async () => JSON.stringify(response),
  }) as typeof fetch;
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/register"]}>
        <Routes>
          <Route path="/register" element={<Register lang="EN" onLangChange={() => {}} />} />
          <Route path="/" element={<Welcome lang="EN" />} />
        </Routes>
        <RegistrationState />
      </MemoryRouter>
    </AuthProvider>
  );
  fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Synthetic" } });
  fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Registration" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: user.email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Synthetic1!" } });
  const submit = screen.getByRole("button", { name: "Register" });
  expect(submit).toBeDisabled();
  expect(global.fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("checkbox"));
  expect(submit).toBeEnabled();
  fireEvent.click(submit);
  expect(await screen.findByRole("heading", { name: "Check your email" })).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(global.fetch).toHaveBeenCalledWith("http://localhost:3001/auth/register", expect.objectContaining({
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: user.name, first_name: "Synthetic", last_name: "Registration", email: user.email, password: "Synthetic1!" }),
  }));
  expect(JSON.parse(screen.getByTestId("registration-state").textContent || "{}")).toEqual({
    pathname: "/register", userId: user.id, pending: true,
  });
  expect(localStorage.getItem("cashback_token")).toBeNull();
  expect(sessionStorage.getItem("cashback_pending_auth")).toBe(response.access_token);
  expect(JSON.parse(sessionStorage.getItem("cashback_pending_verification") || "{}")).toMatchObject({
    email: user.email, verification_email_sent: true,
  });
  for (const key of [wiseKey, enrollmentKey, `${wiseKey}:${user.id}`, `${enrollmentKey}:${user.id}`]) {
    expect(localStorage.getItem(key)).toBeNull();
  }
  expect(readOnboarding(user.id)).toMatchObject({ credentialsSaved: false, eligible: false });
  expect(screen.queryByRole("link", { name: "Open the test email" })).not.toBeInTheDocument();
});
