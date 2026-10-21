import React from "react";
import {fireEvent, render, screen, within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {getCountries} from "libphonenumber-js";
import type {CountryCode} from "libphonenumber-js";
import {readFileSync} from "fs";
import path from "path";
import PhoneInput from "./PhoneInput";

function Field({locale="EN",disabled=false}:{locale?:string;disabled?:boolean}) {
  const [country,setCountry]=React.useState<CountryCode>("GB");
  const [value,setValue]=React.useState("");
  return <PhoneInput id="phone" label="Phone" countryLabel="Country" locale={locale}
    country={country} onCountry={setCountry} value={value} onChange={setValue} disabled={disabled} />;
}
function imageIn(element: HTMLElement) { return element.querySelector("img")!; }

test("default flag and all menu flags are local SVGs with localized names and calling codes",()=>{
  render(<Field />);
  const select=screen.getByRole("combobox",{name:"Country"});
  expect(select).toHaveTextContent("+44");
  expect(imageIn(select)).toHaveAttribute("src","/flags/gb.svg");
  fireEvent.mouseDown(select);
  const options=screen.getAllByRole("option");
  expect(options).toHaveLength(getCountries().length);
  expect(options[0]).toHaveTextContent("United Kingdom (+44)");
  for(const option of options) {
    expect(imageIn(option)).toHaveAttribute("src",`/flags/${option.getAttribute("data-value")!.toLowerCase()}.svg`);
    expect(option).toHaveTextContent(/.+ \(\+\d+\)/);
  }
  fireEvent.click(screen.getByText("Australia (+61)").closest<HTMLElement>('[role="option"]')!);
  expect(select).toHaveTextContent("+61");
  expect(imageIn(select)).toHaveAttribute("src","/flags/au.svg");
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
});

test("selected SVG and typed number survive language changes",()=>{
  const view=render(<Field />);
  fireEvent.mouseDown(screen.getByRole("combobox"));
  fireEvent.click(screen.getByText("Austria (+43)"));
  fireEvent.change(screen.getByRole("textbox"),{target:{value:"0664 1234567"}});
  view.rerender(<Field locale="DE" />);
  expect(imageIn(screen.getByRole("combobox"))).toHaveAttribute("src","/flags/at.svg");
  expect(screen.getByRole("textbox")).toHaveValue("0664 1234567");
  fireEvent.mouseDown(screen.getByRole("combobox"));
  expect(screen.getByRole("listbox").querySelector('[aria-selected="true"]')).toHaveTextContent("Österreich (+43)");
});

test("ISO fallback appears only after a failed image and resets for another country",()=>{
  render(<Field />);
  const select=screen.getByRole("combobox");
  expect(within(select).queryByText("GB")).not.toBeInTheDocument();
  fireEvent.error(imageIn(select));
  expect(within(select).getByText("GB")).toBeInTheDocument();
  fireEvent.mouseDown(select);
  const option=screen.getByText("Australia (+61)").closest<HTMLElement>('[role="option"]')!;
  fireEvent.error(imageIn(option));
  expect(within(option).getByText("AU")).toBeInTheDocument();
  fireEvent.click(option);
  expect(imageIn(select)).toHaveAttribute("src","/flags/au.svg");
});

test("keyboard opens, navigates, selects and dismisses the country list",()=>{
  render(<Field />);
  userEvent.tab();
  expect(screen.getByRole("combobox")).toHaveFocus();
  userEvent.keyboard("{ArrowDown}");
  expect(screen.getByRole("listbox")).toBeInTheDocument();
  expect(screen.getByText("United Kingdom (+44)").closest<HTMLElement>('[role="option"]')!).toHaveFocus();
  userEvent.keyboard("{ArrowDown}{Enter}");
  expect(screen.getByRole("combobox")).toHaveFocus();
  expect(imageIn(screen.getByRole("combobox"))).not.toHaveAttribute("src","/flags/gb.svg");
  userEvent.keyboard("{ArrowDown}{Escape}");
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  userEvent.tab();
  expect(screen.getByRole("textbox")).toHaveFocus();
});

test("disabled selector cannot be opened",()=>{
  render(<Field disabled />);
  expect(screen.getByRole("combobox")).toHaveAttribute("aria-disabled","true");
  fireEvent.mouseDown(screen.getByRole("combobox"));
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
});

test("every supported country has a local self-contained SVG asset",()=>{
  for(const country of getCountries()) {
    const svg=readFileSync(path.join(process.cwd(),"public","flags",`${country.toLowerCase()}.svg`),"utf8");
    expect(svg).toMatch(/<svg\b/);
    expect(svg).not.toMatch(/<script|<foreignObject|(?:href|src)=["']https?:/i);
  }
});
