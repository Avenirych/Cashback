import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import MarketingPreferencesPanel from "./MarketingPreferencesPanel";
import { useAuth } from "../context/AuthContext";
import { translations } from "../i18n";

jest.mock("../context/AuthContext", () => ({useAuth:jest.fn()}));
const initial = {id:7,userId:42,accountUpdates:true,specialOffers:true,partnerRecommendations:false,
  smsMarketing:false,smsMarketingGrantedAt:null,smsMarketingRevokedAt:null,smsMarketingConsentVersion:null,
  createdAt:null,updatedAt:null};
beforeEach(() => {
  jest.useFakeTimers();
  (useAuth as jest.Mock).mockReturnValue({token:"synthetic-token",user:{id:42}});
  global.fetch=jest.fn().mockResolvedValue({ok:true,json:async () => initial}) as typeof fetch;
});
afterEach(() => {jest.clearAllTimers();jest.useRealTimers();jest.resetAllMocks();});

test.each([false,true])("separate SMS preference can be explicitly granted/withdrawn: initially %s", async smsMarketing => {
  (fetch as jest.Mock).mockResolvedValueOnce({ok:true,json:async () => ({...initial,smsMarketing})})
    .mockResolvedValueOnce({ok:true,json:async () => ({...initial,smsMarketing:!smsMarketing})});
  render(<MarketingPreferencesPanel lang="EN" hasPhone />);
  fireEvent.click(await screen.findByRole("button",{name:"Edit"}));
  const sms=screen.getByRole("checkbox",{name:translations.EN.smsMarketing});
  expect(sms).not.toBeRequired();
  if (smsMarketing) expect(sms).toBeChecked(); else expect(sms).not.toBeChecked();
  fireEvent.click(sms);
  await act(async () => {
    fireEvent.click(screen.getByRole("button",{name:translations.EN.savePreferences}));
  });
  expect(await screen.findByText(translations.EN.preferencesSaved)).toBeInTheDocument();
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  expect(fetch).toHaveBeenLastCalledWith("http://localhost:3001/user/marketing-preferences",expect.objectContaining({
    method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer synthetic-token"},
    body:JSON.stringify({specialOffers:true,partnerRecommendations:false,smsMarketing:!smsMarketing}),
  }));
});

test("missing phone prevents a new SMS grant without changing other preferences", async () => {
  render(<MarketingPreferencesPanel lang="RU" />);
  fireEvent.click(await screen.findByRole("button",{name:"Edit"}));
  expect(screen.getByRole("checkbox",{name:translations.RU.smsMarketing})).toBeDisabled();
  expect(screen.getByRole("checkbox",{name:translations.RU.smsMarketing})).not.toBeChecked();
});

test("saving unrelated flags does not replay an existing SMS consent", async () => {
  (fetch as jest.Mock).mockResolvedValue({ok:true,json:async () => ({...initial,smsMarketing:true})});
  render(<MarketingPreferencesPanel lang="EN" hasPhone />);
  fireEvent.click(await screen.findByRole("button",{name:"Edit"}));
  await act(async () => {
    fireEvent.click(screen.getByRole("button",{name:translations.EN.savePreferences}));
  });
  expect(await screen.findByText(translations.EN.preferencesSaved)).toBeInTheDocument();
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  const body=JSON.parse((fetch as jest.Mock).mock.calls[1][1].body);
  expect(body).toEqual({specialOffers:true,partnerRecommendations:false});
  expect(body).not.toHaveProperty("smsMarketing");
});
