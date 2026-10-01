import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Logo from "../components/Logo";
import { useAuth } from "../context/AuthContext";

export default function AdminLogin() {
  const { adminUser, loginAdmin, logoutAdmin } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (adminUser?.role === "admin") navigate("/admin", { replace: true });
  }, [adminUser, navigate]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      setLoading(true);
      await loginAdmin(form.email, form.password);
      navigate("/admin", { replace: true });
    } catch (err) {
      logoutAdmin();
      setError(err.response?.data?.message || "Could not sign in to the admin panel.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="admin-login-page">
      <div className="admin-login-shell">
        <div className="admin-login-brand">
          <Logo compact />
          <div className="admin-login-badge"><ShieldCheck size={17} /> Admin console</div>
        </div>

        <div className="auth-card admin-auth-card">
          <span className="eyebrow">Administrator access</span>
          <h1>Sign in to eLeague Admin</h1>
          <p>Manage deposits, withdrawals, player wallets, rooms, disputes and platform settings.</p>

          <form className="form-stack" onSubmit={submit}>
            <div className="field icon-field">
              <label>Admin email</label>
              <div>
                <Mail size={18} />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="admin@example.com"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="field icon-field">
              <label>Password</label>
              <div>
                <LockKeyhole size={18} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Admin password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
              </div>
            </div>

            {error && <p className="form-error">{error}</p>}

            <button className="btn btn-primary btn-full" disabled={loading}>
              <ShieldCheck size={17} />
              {loading ? "Signing in…" : "Open admin panel"}
            </button>
          </form>

          <p className="auth-switch back-to-login">
            <Link to="/">Back to eLeague</Link>
          </p>
        </div>
      </div>
    </section>
  );
}
