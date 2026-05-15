import { Suspense, lazy } from "react";
import { ErrorBoundary } from "./ErrorBoundary.js";

const MeetingApp = lazy(() => import("./MeetingApp.js"));

export function App() {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-slate-900">
            <div className="text-slate-400 text-sm">Laden…</div>
          </div>
        }
      >
        <MeetingApp />
      </Suspense>
    </ErrorBoundary>
  );
}
