function categoryLabel(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;

  const category = value as Record<string, unknown>;
  if (!Object.hasOwn(category, "_")) return null;

  const label = category._;
  return typeof label === "string" ? label : null;
}

export function feedCategoryText(value: unknown): string {
  const categories = Array.isArray(value) ? value : [value];
  return categories
    .map(categoryLabel)
    .filter((label): label is string => label !== null)
    .join(" ");
}
