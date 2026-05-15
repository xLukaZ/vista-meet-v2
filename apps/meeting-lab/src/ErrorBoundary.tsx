import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 p-8">
          <div className="max-w-2xl w-full bg-red-950 border border-red-700 rounded-xl p-6">
            <h1 className="text-red-400 font-bold text-lg mb-2">Runtime Error</h1>
            <pre className="text-red-300 text-sm overflow-auto whitespace-pre-wrap">
              {this.state.error.message}
              {"\n\n"}
              {this.state.error.stack}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
