import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  label: string;
  className?: string;
}

interface State {
  error: Error | null;
  attempt: number;
}

/** Keeps a WebGL scene failure local to its viewport instead of blanking its route. */
export class ThreeSceneBoundary extends Component<Props, State> {
  override state: State = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  override render() {
    if (this.state.error) {
      return (
        <div className={`flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-amber/30 bg-panel p-6 text-center ${this.props.className ?? ""}`} role="alert">
          <p className="font-display font-semibold text-bright">{this.props.label} is temporarily unavailable</p>
          <p className="max-w-xl break-words text-xs leading-5 text-fog">The 3D view failed to render. The rest of the page is still available.</p>
          <button
            type="button"
            className="rounded-lg bg-amber px-3 py-2 font-mono text-xs font-semibold text-ink hover:bg-amber/90"
            onClick={() => this.setState((state) => ({ error: null, attempt: state.attempt + 1 }))}
          >
            Retry 3D view
          </button>
        </div>
      );
    }

    return <div key={this.state.attempt} className="contents">{this.props.children}</div>;
  }
}
