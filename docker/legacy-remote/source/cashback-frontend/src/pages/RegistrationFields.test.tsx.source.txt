import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Register from "./Register";
import PhoneInput, { countryOptions } from "../components/PhoneInput";
import { translations } from "../i18n";
const mockRegister = jest.fn();
jest.mock("../context/AuthContext", () => ({useAuth: () => ({register: mockRegister, user:null, loading:false})}));
const saved = process.env.REACT_APP_REGISTRATION_ISOLATED;
afterEach(() => {
  if (saved === undefined) delete process.env.REACT_APP_REGISTRATION_ISOLATED;
  else process.env.REACT_APP_REGISTRATION_ISOLATED = saved;
  mockRegister.mockReset(); sessionStorage.clear();
});
test.each(Object.keys(translations))("GB first and localized alphabetical countries in %s", lang => {
  const options = countryOptions(lang);
  expect(options[0].country).toBe("GB");
  expect(options.filter(o => o.country === "GB")).toHaveLength(1);
  const compare = new Intl.Collator(lang.toLowerCase()).compare;
  const rest = options.slice(1);
  for (let i=1;i<rest.length;i++) expect(compare(rest[i-1].name, rest[i].name)).toBeLessThanOrEqual(0);
});
test("language change preserves ISO selection and phone, including shared calling codes", () => {
  const props = {id:"phone",country:"CA" as const,value:"4165550123",onCountry:jest.fn(),onChange:jest.fn(),label:"Phone",countryLabel:"Country"};
  const view=render(<PhoneInput {...props} locale="EN" />);
  fireEvent.mouseDown(screen.getByRole("combobox"));
  const name=screen.getByText("Canada (+1)").textContent;
  view.rerender(<PhoneInput {...props} locale="RU" />);
  expect(screen.getByRole("listbox").querySelector('[aria-selected="true"]')).toHaveAttribute("data-value","CA");
  expect(screen.getByLabelText("Phone")).toHaveValue("4165550123");
  expect(screen.getByText("Канада (+1)").textContent).not.toBe(name);
});
function mount() { return render(<MemoryRouter><Register lang="EN" onLangChange={()=>{}} /></MemoryRouter>); }
function fill(email:string) {
  for (const [label,value] of [["First name","Synthetic"],["Last name","Tester"],["Email",email],["Phone number","020 7946 0123"],["Password","Synthetic1!"]])
    fireEvent.change(screen.getByLabelText(label),{target:{value}});
}
test.each([true,false])("consent, links, field order and email submission in demo=%s", async demo => {
  process.env.REACT_APP_REGISTRATION_ISOLATED=String(demo);
  mockRegister.mockResolvedValue({verification_email_sent:true});
  const {container}=mount();
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  expect(screen.getByLabelText("Email")).toHaveValue("");
  expect(screen.getByRole("combobox",{name:"Phone country"})).toHaveTextContent("+44");

  const ids=Array.from(container.querySelectorAll('form input:not([aria-hidden="true"])')).map(el=>el.id).filter(Boolean);
  expect(ids).toEqual(["firstName","lastName","email","registration-phone","password","terms"]);
  const phone=screen.getByLabelText("Phone number");
  expect(phone.parentElement).toContainElement(screen.getByRole("combobox"));
  fill(demo ? "test38" : "ordinary@other.org");
  for (const [name,path] of [["Terms and Conditions","/terms"],["Privacy Policy","/privacy"]]) {
    const link=screen.getByRole("link",{name});
    expect(link).toHaveAttribute("href",path); expect(link).toHaveAttribute("target","_blank");
    fireEvent.click(link);
    expect(screen.getByLabelText("First name")).toHaveValue("Synthetic");
  }
  fireEvent.submit(container.querySelector("form")!);
  expect(mockRegister).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("checkbox"));
  if(demo) {
    for(const invalid of ["bad@other.org",".bad","a..b","a b"]) {
      fireEvent.change(screen.getByLabelText("Email"),{target:{value:invalid}});
      fireEvent.submit(container.querySelector("form")!); expect(mockRegister).not.toHaveBeenCalled();
    }
    fireEvent.change(screen.getByLabelText("Email"),{target:{value:"test38"}});
    expect(screen.getByText("test38@example.test")).toBeInTheDocument();
  }
  fireEvent.submit(container.querySelector("form")!);
  await waitFor(()=>expect(mockRegister).toHaveBeenCalledWith(expect.objectContaining({email:demo ? "test38@example.test" : "ordinary@other.org",phone_e164:"+442079460123"})));
  expect(await screen.findByRole("heading",{name:"Check your email"})).toBeInTheDocument();
});
test.each([undefined,"false","TRUE","typo"])("demo email requires exact opt-in: %s", value=>{
  if(value===undefined) delete process.env.REACT_APP_REGISTRATION_ISOLATED;
  else process.env.REACT_APP_REGISTRATION_ISOLATED=value;
  mount(); expect(screen.getByLabelText("Email")).toHaveAttribute("type","email");
});
test.each(Object.keys(translations))("translated unchecked consent in %s",lang=>{
  render(<MemoryRouter><Register lang={lang} onLangChange={()=>{}} /></MemoryRouter>);
  const t=translations[lang as keyof typeof translations];
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  expect(screen.getByLabelText(new RegExp(t.agreeTerms))).toBeRequired();
  expect(screen.getByRole("link",{name:t.privacyPolicy})).toHaveAttribute("href","/privacy");
});

test("registration language switch retains selected country and entered number", () => {
  const view=render(<MemoryRouter><Register lang="EN" onLangChange={()=>{}} /></MemoryRouter>);
  fireEvent.mouseDown(screen.getByRole("combobox",{name:"Phone country"}));
  fireEvent.click(screen.getByText("Canada (+1)"));
  fireEvent.change(screen.getByLabelText("Phone number"),{target:{value:"4165550123"}});
  view.rerender(<MemoryRouter><Register lang="FR" onLangChange={()=>{}} /></MemoryRouter>);
  expect(screen.getByRole("combobox")).toHaveTextContent("+1");
  expect(screen.getByRole("textbox",{name:translations.FR.phone})).toHaveValue("4165550123");
});
test("country fallback works without optional Intl APIs", () => {
  const names=Object.getOwnPropertyDescriptor(Intl,"DisplayNames");
  const collator=Object.getOwnPropertyDescriptor(Intl,"Collator");
  try {
    Object.defineProperty(Intl,"DisplayNames",{value:undefined,configurable:true});
    Object.defineProperty(Intl,"Collator",{value:undefined,configurable:true});
    expect(countryOptions("unknown")[0]).toEqual({country:"GB",name:"United Kingdom"});
    expect(countryOptions("RU").find(o=>o.country==="CA")?.name).toBe("CA");
  } finally {
    if(names) Object.defineProperty(Intl,"DisplayNames",names);
    if(collator) Object.defineProperty(Intl,"Collator",collator);
  }
});
