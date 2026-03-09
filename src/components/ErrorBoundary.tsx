import { Component, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        className="flex flex-col items-center justify-center h-full p-8 text-center"
        style={{ background: "var(--bg-primary)" }}
      >
        <div
          className="rounded-xl p-8 border max-w-md w-full"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
        >
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>
            Something went wrong
          </h2>
          <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: "var(--accent)" }}
          >
            <RefreshCw size={14} />
            Try Again
          </button>
        </div>
      </div>
    );
  }
}
