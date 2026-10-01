import { ArrowLeft, Mail } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import Logo from "../components/Logo";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  function submit(e) {
    e.preventDefault();
    setMessage(
      "Password recovery email is not active yet. It will be enabled when eLeague's domain and email service are connected."
    );
  }

  return (
    <section className="auth-page container">
      <div className="auth-card">
        <div className="auth-logo">
          <Logo compact />
        </div>

        <span className="eyebrow">Account recovery</span>
        <h1>Forgot password?</h1>
        <p>
          Enter the email linked to your eLeague account. Email recovery will be activated once the official domain is connected.
        </p>

        <form className="form-stack" onSubmit={submit}>
          <div className="field icon-field">
            <label>Email</label>
            <div>
              <Mail size={18} />
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (message) setMessage("");
                }}
                placeholder="you@example.com"
                required
              />
            </div>
          </div>

          {message && <p className="forgot-password-notice">{message}</p>}

          <button className="btn btn-primary btn-full" type="submit">
            Continue
          </button>
        </form>

        <p className="auth-switch back-to-login">
          <Link to="/login">
            <ArrowLeft size={14} /> Back to login
          </Link>
        </p>
      </div>
    </section>
  );
}
