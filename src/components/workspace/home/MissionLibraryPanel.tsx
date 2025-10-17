"use client";

import { MissionTemplate } from "@/lib/types/mission";

type MissionLibraryPanelProps = {
  templates: MissionTemplate[];
  onTemplateSelect?: (template: MissionTemplate) => void;
};

export function MissionLibraryPanel({ templates, onTemplateSelect }: MissionLibraryPanelProps) {
  return (
    <section
      aria-labelledby="mission-library-heading"
      className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-6"
    >
      <header>
        <h2 id="mission-library-heading" className="text-lg font-semibold text-slate-100">
          Mission library
        </h2>
        <p className="text-sm text-slate-400">
          Featured templates with time-to-value estimates and safeguard reminders.
        </p>
      </header>

      <div className="space-y-3">
        {templates.map((template) => (
          <article
            key={template.id}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition hover:border-cyan-400/50"
          >
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-100">{template.title}</p>
                <p className="text-sm text-slate-300">{template.description}</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-cyan-200">
                <span className="rounded-full bg-cyan-500/15 px-3 py-1 font-semibold text-cyan-200">
                  {template.timeToValueHours}h TTV
                </span>
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-400">
              Safeguards: {template.recommendedSafeguards.join(", ")}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="rounded-full border border-slate-800 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-cyan-300 hover:bg-cyan-400/10 hover:text-cyan-100"
                onClick={() => onTemplateSelect?.(template)}
              >
                Preview template
              </button>
            </div>
          </article>
        ))}
        {templates.length === 0 && (
          <p className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
            Library templates will appear here once missions graduate to the library milestone.
          </p>
        )}
      </div>
    </section>
  );
}
