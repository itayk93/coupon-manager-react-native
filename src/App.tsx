import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./components/ThemeProvider";
import { PrivateRoute } from "./components/layout/PrivateRoute";
import { AppLayout } from "./components/layout/AppLayout";

// Auth Pages
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import ForgotPassword from "./pages/auth/ForgotPassword";

// Public Pages
import About from "./pages/content/About";
import Faq from "./pages/content/Faq";
import Privacy from "./pages/content/Privacy";
import NotFound from "./pages/content/NotFound";

// Protected Pages
import Dashboard from "./pages/dashboard/Dashboard";
import CouponsList from "./pages/coupons/CouponsList";
import Profile from "./pages/settings/Profile";
import Settings from "./pages/settings/Settings";
import Statistics from "./pages/statistics/Statistics";
import SharingPage from "./pages/sharing/SharingPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import Notifications from "./pages/notifications/Notifications";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// A simple dashboard component for now, to be expanded in Phase 5
// Removed placeholder dashboard

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="coupon-master-theme">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path="/about" element={<About />} />
              <Route path="/faq" element={<Faq />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              
              {/* Protected Routes inside AppLayout */}
              <Route element={<PrivateRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/dashboard" element={<Navigate to="/" replace />} />
                  <Route path="/coupons" element={<CouponsList />} />
                  <Route path="/statistics" element={<Statistics />} />
                  <Route path="/sharing" element={<SharingPage />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/admin" element={<AdminDashboard />} />
                </Route>
              </Route>
              
              {/* Catch-all route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <Toaster dir="rtl" />
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
