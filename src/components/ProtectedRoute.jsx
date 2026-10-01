import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, admin = false }) {
  const { user, adminUser, loading, adminLoading, restoreError, adminRestoreError } = useAuth();
  const location = useLocation();

  const activeUser = admin ? adminUser : user;
  const activeLoading = admin ? adminLoading : loading;
  const activeError = admin ? adminRestoreError : restoreError;

  if (activeLoading) return <div className="page-state">Loading…</div>;
  if (!activeUser && activeError) {
    return <div className="page-state"><p>{activeError}</p><button type="button" className="btn btn-secondary" onClick={() => window.location.reload()}>Reload</button></div>;
  }
  if (!activeUser) {
    return <Navigate to={admin ? "/admin/login" : "/login"} state={{ from: location.pathname }} replace />;
  }
  if (admin && activeUser.role !== "admin") return <Navigate to="/admin/login" replace />;
  if (!admin && activeUser.role !== "user") return <Navigate to="/login" replace />;
  return children;
}
