import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import type { AuthState } from "@/store/authStore";
import styles from "./DashboardPage.module.css";

export function DashboardPage(): JSX.Element {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore((s: AuthState) => s);

  const handleLogout = (): void => {
    logout();
    navigate("/login", { replace: true });
  };

  const stats = [
    { label: "Pipeline Runs",   value: "247",  trend: "+12%" },
    { label: "Success Rate",    value: "98.4%", trend: "+0.6%" },
    { label: "Avg Deploy Time", value: "3m 42s", trend: "-18s" },
    { label: "Active Services", value: "4",    trend: "stable" },
  ];

  return (
    <div className={styles.container}>
      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>⚡ MyApp</div>
        <nav className={styles.nav}>
          <a className={`${styles.navItem} ${styles.active}`} href="#">Dashboard</a>
          <a className={styles.navItem} href="#">Pipelines</a>
          <a className={styles.navItem} href="#">Deployments</a>
          <a className={styles.navItem} href="#">Settings</a>
        </nav>
        <button id="logout-btn" className={styles.logoutBtn} onClick={handleLogout}>
          Sign Out
        </button>
      </aside>

      {/* ── Main ── */}
      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.heading}>Dashboard</h1>
            <p className={styles.subheading}>Welcome back, {user?.name ?? "User"}</p>
          </div>
          <div className={styles.badge}>Production ✓</div>
        </header>

        {/* Stats grid */}
        <section className={styles.statsGrid}>
          {stats.map((s) => (
            <div key={s.label} className={styles.statCard}>
              <span className={styles.statValue}>{s.value}</span>
              <span className={styles.statLabel}>{s.label}</span>
              <span className={styles.statTrend}>{s.trend}</span>
            </div>
          ))}
        </section>

        {/* Recent deploys */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Recent Deployments</h2>
          <div className={styles.table}>
            {[
              { id: "#247", service: "backend-api",   env: "production", status: "success", time: "2m ago" },
              { id: "#246", service: "frontend-app",  env: "production", status: "success", time: "2m ago" },
              { id: "#245", service: "backend-api",   env: "staging",    status: "success", time: "1h ago" },
              { id: "#244", service: "frontend-app",  env: "staging",    status: "failed",  time: "2h ago" },
            ].map((row) => (
              <div key={row.id} className={styles.tableRow}>
                <span className={styles.buildId}>{row.id}</span>
                <span>{row.service}</span>
                <span className={styles.env}>{row.env}</span>
                <span className={`${styles.status} ${styles[row.status]}`}>
                  {row.status === "success" ? "✅" : "❌"} {row.status}
                </span>
                <span className={styles.time}>{row.time}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
