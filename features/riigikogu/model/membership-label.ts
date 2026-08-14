function romanNumeral(value: number): string {
  const numerals: Array<[number, string]> = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let remainder = value;
  let result = "";
  for (const [amount, numeral] of numerals) {
    while (remainder >= amount) {
      result += numeral;
      remainder -= amount;
    }
  }
  return result;
}

export function riigikoguMembershipLabel(membership: number | null): string {
  if (membership === null || !Number.isSafeInteger(membership) || membership < 1 || membership > 3999) {
    return "Riigikogu";
  }
  return `${romanNumeral(membership)} Riigikogu`;
}
