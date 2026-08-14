import { integer, record } from "./riigikogu-parser.ts";

export function parseCurrentMembership(value: unknown): number {
  const membership = record(value, "current membership");
  const membershipNumber = integer(membership.number, "membership number");
  if (membershipNumber < 1) {
    throw new TypeError("Riigikogu membership number must be positive");
  }
  return membershipNumber;
}
