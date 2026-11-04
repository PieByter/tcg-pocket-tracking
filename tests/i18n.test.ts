import { describe, expect, it } from "vitest";
import { en, id, createI18n, intlLocale, isLocale } from "@/lib/i18n";

const placeholders = (value: string) =>
  [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

describe("i18n dictionaries", () => {
  it("Bahasa Indonesia memiliki semua key English", () => {
    expect(Object.keys(id).sort()).toEqual(Object.keys(en).sort());
  });

  it("tidak ada terjemahan kosong", () => {
    const empty = Object.entries(id).filter(([, value]) => value.trim().length === 0);
    expect(empty).toEqual([]);
  });

  it("placeholder sama di kedua bahasa", () => {
    const mismatched = Object.keys(en).filter(
      (key) =>
        JSON.stringify(placeholders(en[key as keyof typeof en])) !==
        JSON.stringify(placeholders(id[key as keyof typeof en])),
    );
    expect(mismatched).toEqual([]);
  });

  it("default English dan fallback key aman", () => {
    const { t } = createI18n("en");
    expect(t("nav.dashboard")).toBe("Dashboard");
    expect(t("dash.kpi.accounts.detail", { ok: 6, needs: 2 })).toBe(
      "6 meet the requirement · 2 need help",
    );
  });

  it("Bahasa Indonesia mengganti teks dan format angka", () => {
    const { t } = createI18n("id");
    expect(t("nav.dashboard")).toBe("Dashboard");
    expect(t("dash.kpi.accounts.detail", { ok: 6, needs: 2 })).toBe(
      "6 memenuhi syarat · 2 butuh bantuan",
    );
    expect(intlLocale("id")).toBe("id-ID");
    expect(intlLocale("en")).toBe("en-GB");
  });

  it("validasi locale cookie", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("id")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});
