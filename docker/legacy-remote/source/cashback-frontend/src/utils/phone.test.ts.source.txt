import { canonicalPhone } from "./phone";

test.each([
  // Ofcom drama range: London 020 7946 0000–0999; valid in pinned max metadata.
  ["020 7946 0123", "GB", "+442079460123"],
  ["202 555 0123", "US", "+12025550123"],
  ["+1 (202) 555-0123", "GB", "+12025550123"],
] as const)("normalizes %s with country %s", (input, country, expected) => {
  expect(canonicalPhone(input, country)).toBe(expected);
});

test.each(["", "123", "call +442079460123", "+442079460123 ext 2", "+000123", "x".repeat(65)])(
  "rejects missing or invalid phone %#", input => {
    expect(canonicalPhone(input, "GB")).toBeNull();
  },
);
