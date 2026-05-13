import { Routes, Route, Navigate } from "react-router-dom";
import { LoginPage }     from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { TasksPage }     from "@/pages/TasksPage";
import { useAuthStore }  from "@/store/authStore";
import type { AuthState } from "@/store/authStore";

function PrivateRoute({ children }: { children: React.ReactNode }): JSX.Element {
  const token = useAuthStore((s: AuthState) => s.token);
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <DashboardPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/tasks"
        element={
          <PrivateRoute>
            <TasksPage />
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
