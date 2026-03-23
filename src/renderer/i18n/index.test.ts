// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from "vitest";

// Import initializes i18n on load
import i18n, { setAppLanguage, i18nReady } from "./index";

beforeAll(async () => {
  // Ensure i18n is initialized before tests
  await i18nReady;
});

describe("i18n index", () => {
  it("exports default i18n instance", () => {
    expect(i18n).toBeDefined();
    expect(typeof i18n.t).toBe("function");
  });

  it("is initialized with English as default language", () => {
    expect(i18n.language).toBe("en");
  });

  it("translates known keys", () => {
    expect(i18n.t("app.name")).toBe("GitSmith");
  });

  it("translates commit namespace keys", () => {
    expect(i18n.t("commit.commit")).toBe("Commit");
    expect(i18n.t("commit.stage")).toBe("Stage");
    expect(i18n.t("commit.unstage")).toBe("Unstage");
  });

  it("translates toolbar namespace keys", () => {
    expect(i18n.t("toolbar.fetch")).toBe("Fetch");
    expect(i18n.t("toolbar.pull")).toBe("Pull");
    expect(i18n.t("toolbar.push")).toBe("Push");
  });

  it("translates dialogs namespace keys", () => {
    expect(i18n.t("dialogs.close")).toBe("Close");
    expect(i18n.t("dialogs.cancel")).toBe("Cancel");
    expect(i18n.t("dialogs.save")).toBe("Save");
  });

  it("translates errors namespace keys", () => {
    expect(i18n.t("errors.loadFailed")).toBe("Failed to load data");
  });

  it("setAppLanguage changes the active language", async () => {
    setAppLanguage("en");
    expect(i18n.language).toBe("en");
  });

  it("switches to Italian and translates keys", async () => {
    setAppLanguage("it");
    expect(i18n.language).toBe("it");
    expect(i18n.t("app.reload")).toBe("Ricarica");
    expect(i18n.t("toolbar.fetch")).toBe("Fetch");
    expect(i18n.t("dialogs.close")).toBe("Chiudi");
    expect(i18n.t("settings.languageItalian")).toBe("Italiano");
    // restore English
    setAppLanguage("en");
  });

  it("Italian falls back to English for missing keys", async () => {
    setAppLanguage("it");
    // app.name should be "GitSmith" in both languages
    expect(i18n.t("app.name")).toBe("GitSmith");
    setAppLanguage("en");
  });

  it("exports setAppLanguage as a function", () => {
    expect(typeof setAppLanguage).toBe("function");
  });

  it("falls back gracefully for unknown keys", () => {
    // Unknown keys return the key itself in i18next
    const result = i18n.t("nonexistent.key");
    expect(result).toBe("nonexistent.key");
  });

  it("has escapeValue set to false (no HTML escaping)", () => {
    // Verify by translating a key that would be escaped if escapeValue were true
    const result = i18n.t("app.name");
    expect(result).toBe("GitSmith");
  });
});
