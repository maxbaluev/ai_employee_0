export default function PrepareStage() {
  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-slate-100">Prepare</h2>
        <p className="text-sm text-slate-300">
          Toolkit discovery and readiness blueprint. Hook Inspector agent output
          into readiness visualizations per <code>docs/02_system_overview.md</code>.
        </p>
      </header>
      <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/30 p-6 text-sm text-slate-400">
        TODO: Render toolkit inventory, OAuth status badges, and coverage
        meters. Use Composio discovery responses and Supabase cache as described
        in <code>docs/04_implementation_guide.md</code>.
      </div>
    </section>
  );
}
