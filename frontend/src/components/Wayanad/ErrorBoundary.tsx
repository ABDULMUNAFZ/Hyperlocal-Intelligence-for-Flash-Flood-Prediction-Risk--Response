import React from 'react';

interface State { error: Error | null }

/** Keeps a map/runtime failure from blanking the whole command center. */
export class CommandCenterErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('FloodGuard command center error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="fixed inset-0 grid place-items-center bg-slate-950 text-slate-100 p-6">
        <div className="max-w-md text-center">
          <div className="text-[13px] font-extrabold tracking-[0.3em]">FLOODGUARD</div>
          <div className="mt-4 text-[14px] font-semibold">The map view hit an error and was stopped.</div>
          <div className="mt-2 font-mono text-[11px] text-rose-300 break-words">{this.state.error.message}</div>
          <button onClick={() => location.reload()} className="mt-5 rounded-lg bg-sky-600 px-4 py-2 text-[12px] font-semibold hover:bg-sky-700">Reload command center</button>
          <div className="mt-4 text-[10.5px] text-slate-500">For emergencies call 112 · District EOC 1077</div>
        </div>
      </div>
    );
  }
}
