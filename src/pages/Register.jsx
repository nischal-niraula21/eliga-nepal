import { CheckCircle2, Eye, EyeOff, Gift, LockKeyhole, Mail, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/client";
import Logo from "../components/Logo";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const referralFromLink = (searchParams.get("ref") || "").trim().toUpperCase();

  const [form, setForm] = useState({ name: "", email: "", password: "", referralCode: referralFromLink });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [referralState, setReferralState] = useState({ checking: false, valid: false, message: "" });
  const [loading, setLoading] = useState(false);

  async function validateReferral(value = form.referralCode) {
    const code = String(value || "").trim().toUpperCase();
    if (!code) {
      setReferralState({ checking: false, valid: false, message: "" });
      return true;
    }
    try {
      setReferralState({ checking: true, valid: false, message: "Checking referral code…" });
      const { data } = await api.get(`/referrals/validate/${encodeURIComponent(code)}`);
      setForm((current) => ({ ...current, referralCode: data.code || code }));
      setReferralState({ checking: false, valid: true, message: `Referral code applied${data.referrerName ? ` from ${data.referrerName}` : ""}.` });
      return true;
    } catch (err) {
      setReferralState({ checking: false, valid: false, message: err.response?.data?.message || "Referral code not found." });
      return false;
    }
  }

  useEffect(() => {
    if (referralFromLink) validateReferral(referralFromLink);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (form.referralCode.trim() && !(await validateReferral())) return;
    try {
      setLoading(true);
      await register({ ...form, referralCode: form.referralCode.trim().toUpperCase() });
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Could not create account.");
    } finally { setLoading(false); }
  }

  return (
    <section className="auth-page container">
      <div className="auth-card wide">
        <div className="auth-logo"><Logo compact /></div>
        <span className="eyebrow">Start playing</span>
        <h1>Create your account</h1>
        <p>Create one eLeague account. You can connect your eFootball, Free Fire, PUBG Mobile and FC Mobile identities later when you play.</p>

        <form className="form-stack" onSubmit={submit}>
          <div className="two-col">
            <div className="field icon-field"><label>Name</label><div><UserRound size={18} /><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" required /></div></div>
            <div className="field icon-field"><label>Email</label><div><Mail size={18} /><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" required /></div></div>
          </div>

          <div className="field icon-field">
            <label>Referral code <small>(optional)</small></label>
            <div className={form.referralCode && referralState.message && !referralState.valid && !referralState.checking ? "invalid-wrap" : ""}>
              <Gift size={18} />
              <input value={form.referralCode} onChange={(e) => { setForm({ ...form, referralCode: e.target.value.toUpperCase() }); setReferralState({ checking: false, valid: false, message: "" }); }} onBlur={() => validateReferral()} placeholder="Enter referral code" autoCapitalize="characters" />
              {referralState.valid && <CheckCircle2 className="input-success-icon" size={18} />}
            </div>
            {referralState.message && <p className={referralState.valid ? "field-success" : referralState.checking ? "field-hint" : "field-error"}>{referralState.message}</p>}
          </div>

          <div className="field icon-field"><label>Password</label><div><LockKeyhole size={18} /><input type={showPassword ? "text" : "password"} minLength="8" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 8 characters" required /><button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <Eye size={18} /> : <EyeOff size={18} />}</button></div></div>

          <div className="auth-info-strip">Game usernames are added only when you play that game, so you do not need to fill IDs for games you never use.</div>
          {error && <p className="form-error">{error}</p>}
          <button className="btn btn-primary btn-full" disabled={loading || referralState.checking}>{loading ? "Creating…" : "Create account"}</button>
        </form>
        <p className="auth-switch">Already registered? <Link to="/login">Log in</Link></p>
      </div>
    </section>
  );
}
