import type { IntakeMessage, IntakeStatus } from "@/hooks/useMissionIntake";

type CopilotChatRailProps = {
  messages: IntakeMessage[];
  status: IntakeStatus;
};

export function CopilotChatRail({ messages, status }: CopilotChatRailProps) {
  return (
    <aside
      aria-label="Copilot chat"
      className="flex h-full flex-col rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm"
    >
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
          Intake Agent chat
        </h2>
        <span className="text-xs text-slate-500">Status: {status}</span>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/50 p-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`rounded-lg border px-3 py-2 text-sm leading-relaxed ${
              message.role === "assistant"
                ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-100"
                : message.role === "user"
                ? "border-slate-700 bg-slate-900/80 text-slate-200"
                : "border-slate-800 bg-slate-900/80 text-slate-300"
            }`}
          >
            <p>{message.text}</p>
            <time className="mt-1 block text-[10px] uppercase tracking-wide text-slate-400">
              {new Date(message.timestamp).toLocaleTimeString()}
            </time>
          </div>
        ))}
      </div>

      <footer className="mt-3 text-xs text-slate-500">
        Streaming hooks will replace this rail once CopilotKit is connected to the IntakeAgent.
      </footer>
    </aside>
  );
}
