export const dynamic = "force-dynamic";

export default function GlobalErrorPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 py-20 text-center text-slate-100">
      <h1 className="text-3xl font-semibold">Something went wrong</h1>
      <p className="mt-4 max-w-md text-sm text-slate-400">
        We couldn&apos;t render this view during the build. Please reload the page to try again, or reach out to the runtime steward if the issue persists.
      </p>
    </div>
  );
}
