import { Gamepad2, House, Plus, ShieldCheck, Trophy, UserRound, Wallet } from "lucide-react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { money } from "../utils/format";
import Logo from "./Logo";
import NotificationBell from "./NotificationBell";
import PwaInstallPrompt from "./PwaInstallPrompt";
import AnnouncementPopup from "./AnnouncementPopup";

export default function Layout({ children }) {
  const { user, logout, adminUser, logoutAdmin } = useAuth();
  const location = useLocation();
  const navClass = ({ isActive }) => `nav-link ${isActive ? "active" : ""}`;
  const bottomClass = ({ isActive }) => `bottom-nav-link ${isActive ? "active" : ""}`;

  const isAdminPath = location.pathname.startsWith("/admin");
  const isAdminLogin = location.pathname === "/admin/login";
  const activeUser = isAdminPath ? adminUser : user;
  const isAdmin = isAdminPath && adminUser?.role === "admin";

  if (isAdminLogin) {
    return <div className="app-shell admin-auth-shell"><main className="main-content">{children}</main></div>;
  }

  return (
    <div className={`app-shell ${isAdmin ? "admin-shell" : ""}`}>
      <header className={`site-header ${isAdmin ? "admin-header" : ""}`}>
        <div className="container header-inner">
          <Link to={isAdmin ? "/admin" : "/"} className="brand-link" aria-label={isAdmin ? "eLeague admin" : "eLeague home"}><Logo compact /></Link>

          {isAdmin ? (
            <div className="admin-header-label"><ShieldCheck size={17} /><span>Admin Console</span></div>
          ) : (
            <nav className="main-nav">
              <NavLink className={navClass} to="/lobby">Lobby</NavLink>
              {user?.role === "user" && <NavLink className={navClass} to="/matches"><Trophy size={16} /> Matches</NavLink>}
              {user?.role === "user" && <NavLink className={navClass} to="/wallet"><Wallet size={16} /> Wallet</NavLink>}
              {user?.role === "user" && <NavLink className={navClass} to="/create"><Plus size={16} /> Create room</NavLink>}
            </nav>
          )}

          <div className={`header-actions ${isAdmin ? "admin-header-actions" : ""}`}>
            {activeUser ? (
              <>
                {!isAdmin && user?.role === "user" && <Link to="/wallet" className="wallet-pill"><Wallet size={16} /><b>{money(user.walletBalance)}</b></Link>}
                {!isAdmin && user?.role === "user" && <NotificationBell />}
                {!isAdmin && user?.role === "user" && <Link to="/profile" className="profile-button"><UserRound size={18} /><span>{user.name.split(" ")[0]}</span></Link>}
                {isAdmin && <div className="admin-identity"><span>Signed in as</span><b>{adminUser.name}</b></div>}
                <button className="ghost-button" onClick={isAdmin ? logoutAdmin : logout}>Log out</button>
              </>
            ) : (
              !isAdminPath && <>
                <Link to="/login" className="ghost-button desktop-only">Log in</Link>
                <Link to="/register" className="btn btn-primary desktop-only">Create account</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="main-content">{children}</main>

      {!isAdminPath && <AnnouncementPopup />}
      {!isAdminPath && <PwaInstallPrompt />}

      {!isAdminPath && (
        <footer className="fixed-bottom-nav" aria-label="Primary player navigation">
          <div className="bottom-nav-inner">
            <NavLink to="/" end className={bottomClass}>
              <span className="bottom-nav-icon"><House size={23} /></span>
              <span>Home</span>
            </NavLink>
            <NavLink to="/lobby" className={bottomClass}>
              <span className="bottom-nav-icon"><Gamepad2 size={23} /></span>
              <span>Play</span>
            </NavLink>
            <NavLink to={user?.role === "user" ? "/wallet" : "/login"} className={bottomClass}>
              <span className="bottom-nav-icon"><Wallet size={23} /></span>
              <span>Wallet</span>
            </NavLink>
          </div>
        </footer>
      )}
    </div>
  );
}
