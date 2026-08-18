import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { logError } from '@/lib/errorReporting';

type Props = { children: ReactNode; boundaryName?: string };
type State = { hasError: boolean };

class PageErrorBoundaryInner extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[Page] render error (${this.props.boundaryName || 'page'})`, error, info);
    void logError(
      `render_crash:${this.props.boundaryName || 'page'}`,
      new Error(`${error.message}\n\nComponent stack:${info.componentStack}`),
      'critical',
    );
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="flex min-h-[60vh] items-center justify-center bg-slate-50 p-6" dir="rtl">
        <section className="w-full max-w-lg rounded-2xl bg-white p-8 text-center shadow-lg" role="alert">
          <h1 className="mb-3 text-2xl font-bold text-slate-900">אירעה שגיאה בעמוד הזה</h1>
          <p className="mb-6 text-slate-600">אפשר לנסות לרענן, או לחזור לדף הבית.</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => window.location.reload()}>נסה שוב</Button>
            <Button variant="outline" onClick={() => { window.location.href = '/'; }}>לדף הבית</Button>
          </div>
        </section>
      </main>
    );
  }
}

export function PageErrorBoundary({ children, boundaryName }: Props) {
  const location = useLocation();
  return (
    <PageErrorBoundaryInner key={location.pathname} boundaryName={boundaryName}>
      {children}
    </PageErrorBoundaryInner>
  );
}
