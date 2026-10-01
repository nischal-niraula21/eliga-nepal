export default function Logo({ compact = false }) {
  return (
    <img
      src="/eliga-logo.png"
      alt="eLeague"
      className={compact ? "brand-logo brand-logo-compact" : "brand-logo"}
    />
  );
}
