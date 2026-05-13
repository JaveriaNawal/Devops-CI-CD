import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import type { AuthState } from "@/store/authStore";
import styles from "./LoginPage.module.css";

export function LoginPage(): JSX.Element {
  const navigate  = useNavigate();
  const setAuth   = useAuthStore((s: AuthState) => s.setAuth);

  const [mode,     setMode]     = useState<"login" | "register">("login");
  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  const reset = () => { setName(""); setEmail(""); setPassword(""); setError(null); };

  const toggleMode = () => { setMode(m => m === "login" ? "register" : "login"); reset(); };

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        const { data } = await authApi.login(email, password);
        setAuth(data.token, data.user);
        navigate("/dashboard", { replace: true });
      } else {
        const { data } = await authApi.register(name, email, password);
        setAuth(data.token, data.user);
        navigate("/dashboard", { replace: true });
      }
    } catch (err: any) {
      setError(err.response?.data?.error ?? (mode === "login" ? "Login failed." : "Registration failed."));
    } finally {
      setLoading(false);
    }
  };

  const isLogin = mode === "login";

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.logo}>⚡</div>
        <h1 className={styles.title}>{isLogin ? "Welcome back" : "Create account"}</h1>
        <p className={styles.subtitle}>{isLogin ? "Sign in to your account" : "Get started for free"}</p>

        {error && (
          <div className={styles.errorBanner} role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          {!isLogin && (
            <>
              <label className={styles.label} htmlFor="name">Full Name</label>
              <input
                id="name"
                type="text"
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                placeholder="John Doe"
              />
            </>
          )}

          <label className={styles.label} htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            className={styles.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@example.com"
          />

          <label className={styles.label} htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            className={styles.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={isLogin ? "current-password" : "new-password"}
            placeholder="••••••••"
          />

          <button
            id="auth-submit"
            type="submit"
            className={styles.button}
            disabled={loading}
          >
            {loading ? (isLogin ? "Signing in…" : "Creating account…") : (isLogin ? "Sign in" : "Create account")}
          </button>
        </form>

        <p className={styles.switchText}>
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button id="toggle-mode" className={styles.switchLink} onClick={toggleMode} type="button">
            {isLogin ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
