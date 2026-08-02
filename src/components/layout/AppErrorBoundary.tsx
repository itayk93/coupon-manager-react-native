import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[App] render error', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6" dir="rtl">
        <section className="w-full max-w-lg rounded-2xl bg-white p-8 text-center shadow-lg" role="alert">
          <h1 className="mb-3 text-2xl font-bold text-slate-900">אירעה שגיאה בטעינת העמוד</h1>
          <p className="mb-6 text-slate-600">רענון קצר אמור לפתור את הבעיה. אם היא חוזרת, נסה שוב בעוד רגע.</p>
          <Button onClick={() => window.location.reload()}>רענון</Button>
        </section>
      </main>
    );
  }
}
