import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const styles = readFileSync(resolve(import.meta.dir, "../src/styles.css"), "utf8");
const AA_NORMAL_TEXT_RATIO = 4.5;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function rule(selector: string) {
  const match = styles.match(new RegExp(`${escapeRegExp(selector)}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`CSS rule not found: ${selector}`);
  return match[1];
}

function customProperties(selector: string) {
  return Object.fromEntries(
    [...rule(selector).matchAll(/(--[\w-]+)\s*:\s*(#[\da-fA-F]{6})\s*;/g)].map((match) => [match[1], match[2]]),
  );
}

function relativeLuminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(first: string, second: string) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

const lightTheme = customProperties(".app");
const darkTheme = { ...lightTheme, ...customProperties(".app.theme-dark") };

const semanticPairs = [
  { name: "accent action", foreground: "--accent-contrast", background: "--accent" },
  { name: "accent action hover", foreground: "--accent-contrast", background: "--accent-dark" },
  { name: "strong selected action", foreground: "--paper", background: "--ink" },
  { name: "award action", foreground: "--gold-contrast", background: "--gold" },
] as const;

describe.each([
  ["light", lightTheme],
  ["dark", darkTheme],
])("%s theme button contrast", (_theme, properties) => {
  test.each(semanticPairs)("$name meets WCAG AA", ({ foreground, background }) => {
    const foregroundColor = properties[foreground];
    const backgroundColor = properties[background];

    expect(foregroundColor, `${foreground} must be a six-digit hex color`).toBeDefined();
    expect(backgroundColor, `${background} must be a six-digit hex color`).toBeDefined();
    expect(contrastRatio(foregroundColor, backgroundColor)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT_RATIO);
  });
});

describe("button rules use the audited semantic color pairs", () => {
  test.each([
    [".filter-toggle span", "--accent-contrast", "--accent"],
    [".primary-action", "--accent-contrast", "--accent"],
    [".mobile-nav button.is-active", "--paper", "--ink"],
    [".map-cluster.is-special", "--gold-contrast", "--gold"],
  ])("%s", (selector, foreground, background) => {
    const declarations = rule(selector);
    expect(declarations).toMatch(new RegExp(`color\\s*:\\s*var\\(${foreground}\\)`));
    expect(declarations).toMatch(new RegExp(`background\\s*:\\s*var\\(${background}\\)`));
  });
});
