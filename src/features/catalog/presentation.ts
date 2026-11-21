import { capabilities } from "./schemas/query";

export function number(value: number | null) {
  return value === null ? "Unknown" : new Intl.NumberFormat("en-US").format(value);
}

export function date(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? "Unknown";
}

export function utcTime(value: Date) {
  return `${value.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function isRecentlyAdded(value: Date, now: number) {
  return +value <= now && now - +value < 7 * 24 * 60 * 60 * 1_000;
}

export function capabilityNames(value: unknown) {
  return Array.isArray(value) ? Object.entries(capabilities).filter(([key]) => value.includes(key)).map(([, label]) => label) : [];
}

export function modalityNames(value: unknown, direction: "input" | "output") {
  if (value === null || typeof value !== "object") return [];
  const modes = (value as Record<string, unknown>)[direction];
  return Array.isArray(modes) ? modes.filter((mode): mode is string => typeof mode === "string") : [];
}

export function list(values: string[]) {
  return values.length ? values.join(", ") : "Unknown";
}

export const availability = {
  LISTED: "Listed in provider docs", UNAVAILABLE: "Unavailable", UNKNOWN: "Availability unknown",
} as const;

export function safeSource(url: string) {
  try {
    const source = new URL(url);
    return source.protocol === "https:" && !source.username && !source.password ? source.href : null;
  } catch {
    return null;
  }
}
