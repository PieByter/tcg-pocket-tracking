"use client";

import { useRef, useState, useTransition } from "react";
import { applyImport, previewImport, type ImportReport } from "@/app/actions";
import { Icon } from "./icon";
import { useI18n } from "./i18n-provider";

const SAMPLE = [
  "card,account,qty,target",
  "A1-1,Akun 1: Main,2,1",
  "PROMO-A-3,2,1",
].join("\n");

export function ImportPanel() {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [payload, setPayload] = useState("");
  const [mode, setMode] = useState<"set" | "add">("set");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [running, setRunning] = useState<"preview" | "apply" | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (kind: "preview" | "apply") => {
    if (kind === "apply" && !window.confirm(t("data.import.confirm"))) return;
    const formData = new FormData();
    formData.set("payload", payload);
    formData.set("mode", mode);
    setRunning(kind);
    startTransition(async () => {
      const response = kind === "preview" ? await previewImport(formData) : await applyImport(formData);
      setReport(response);
      setRunning(null);
    });
  };

  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    setPayload(await file.text());
    if (fileRef.current) fileRef.current.value = "";
  };

  const busy = pending || running !== null;

  return (
    <div className="panel space-y-3 p-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex-1">
          <span className="label-xs">{t("data.import.payload")}</span>
          <textarea
            value={payload}
            onChange={(event) => setPayload(event.target.value)}
            rows={8}
            spellCheck={false}
            placeholder={SAMPLE}
            className="field mt-1 w-full font-mono text-xs leading-relaxed"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label>
          <span className="label-xs">{t("data.import.mode")}</span>
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value === "add" ? "add" : "set")}
            className="field mt-1 w-auto"
          >
            <option value="set">{t("data.import.modeSet")}</option>
            <option value="add">{t("data.import.modeAdd")}</option>
          </select>
        </label>
        <label className="btn-secondary cursor-pointer">
          <Icon name="arrowUp" className="h-4 w-4" />
          {t("data.import.file")}
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="sr-only"
            onChange={(event) => void loadFile(event.target.files?.[0])}
          />
        </label>
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => run("preview")}>
          <Icon name={running === "preview" ? "repeat" : "search"} className={`h-4 w-4 ${running === "preview" ? "animate-spin" : ""}`} />
          {t("data.import.preview")}
        </button>
        <button type="button" className="btn-primary" disabled={busy} onClick={() => run("apply")}>
          <Icon name={running === "apply" ? "repeat" : "check"} className={`h-4 w-4 ${running === "apply" ? "animate-spin" : ""}`} />
          {t("data.import.apply")}
        </button>
      </div>

      <p className="text-xs text-on-surface-variant">{t("data.import.format")}</p>

      {report && (
        <div className="space-y-2">
          <p className={`text-xs ${report.ok ? "text-success" : "text-rose-300"}`}>
            {t(report.key, { ...report.params, count: report.issueTotal })}
          </p>
          {report.issues.length > 0 && (
            <div className="rounded-lg border border-rose-400/25 bg-rose-400/[0.06] p-2">
              <p className="label-xs text-rose-300">{t("import.errors")}</p>
              <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-on-surface-variant">
                {report.issues.map((issue, index) => (
                  <li key={`${issue.line}-${index}`}>{t(issue.key, issue.params)}</li>
                ))}
              </ul>
              {report.issueTotal > report.issues.length && (
                <p className="mt-1 text-[11px] text-outline">
                  {t("import.truncated", { shown: report.issues.length, total: report.issueTotal })}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
