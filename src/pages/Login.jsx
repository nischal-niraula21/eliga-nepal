import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Logo from "../components/Logo";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");

    try {
      setLoading(true);
      const user = await login(form.email, form.password);
      navigate(location.state?.from || (user.role === "admin" ? "/admin" : "/"), {
        replace: true,
      });
    } catch (err) {
      setError(err.response?.data?.message || "Could not log in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="auth-page container">
      <div className="auth-card">
        <div className="auth-logo">
          <Logo compact />
        </div>

        <span className="eyebrow">Welcome back</span>
        <h1>Log in to eLeague</h1>
        <p>Access your wallet, rooms and match history.</p>

        <form className="form-stack" onSubmit={submit}>
          <div className="field icon-field">
            <label>Email</label>
            <div>
              <Mail size={18} />
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com"
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
                placeholder="Your password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>

            <Link className="forgot-password-link forgot-password-link-inline" to="/forgot-password">
              Forgot password?
            </Link>
          </div>

          {error && <p className="form-error">{error}</p>}

          <button className="btn btn-primary btn-full" disabled={loading}>
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>

        <p className="auth-switch">
          New to eLeague? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </section>
  );
}
