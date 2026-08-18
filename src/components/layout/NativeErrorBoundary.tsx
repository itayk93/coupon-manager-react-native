import { Component, type ErrorInfo, type ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAppTheme } from "@/contexts/ThemeContext";
import { logError } from "@/lib/errorReporting";
import { fonts } from "@/lib/theme";

type Props = { children: ReactNode };
type State = { hasError: boolean };

class NativeErrorBoundaryInner extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Native] render error", error, info);
    void logError(
      "render_crash:native",
      new Error(`${error.message}\n\nComponent stack:${info.componentStack}`),
      "critical",
    );
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <NativeErrorFallback
        onReset={() => this.setState({ hasError: false })}
      />
    );
  }
}

function NativeErrorFallback({ onReset }: { onReset: () => void }) {
  const { theme } = useAppTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>אירעה שגיאה בטעינת המסך</Text>
      <Text style={[styles.subtitle, { color: theme.textMuted }]}>
        אפשר לנסות שוב. אם הבעיה חוזרת, נסה לרענן את האפליקציה.
      </Text>
      <TouchableOpacity
        onPress={onReset}
        style={[styles.button, { backgroundColor: theme.primary }]}
      >
        <Text style={styles.buttonText}>נסה שוב</Text>
      </TouchableOpacity>
    </View>
  );
}

export function NativeErrorBoundary({ children }: Props) {
  return <NativeErrorBoundaryInner>{children}</NativeErrorBoundaryInner>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontFamily: fonts.bodyBold,
    fontSize: 20,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 18,
    lineHeight: 21,
  },
  button: {
    height: 46,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#ffffff",
    fontFamily: fonts.bodyBold,
    fontSize: 14,
  },
});
