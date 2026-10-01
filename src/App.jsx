import { BrowserRouter, Navigate, Route, Routes, useSearchParams } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Lobby from "./pages/Lobby";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import CreateRoom from "./pages/CreateRoom";
import JoinRoom from "./pages/JoinRoom";
import RoomDetail from "./pages/RoomDetail";
import MyMatches from "./pages/MyMatches";
import Wallet from "./pages/Wallet";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import AdminLogin from "./pages/AdminLogin";
import BackendStatus from "./components/BackendStatus";


function HomeEntry() {
  const [searchParams] = useSearchParams();
  const referralCode = (searchParams.get("ref") || "").trim().toUpperCase();

  if (referralCode) {
    return <Navigate to={`/register?ref=${encodeURIComponent(referralCode)}`} replace />;
  }

  return <Home />;
}

function AppRoutes() {
  return (
    <Layout>
      <BackendStatus />
      <Routes>
        <Route path="/" element={<HomeEntry />} />
        <Route path="/lobby" element={<Lobby />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
        <Route path="/create" element={<ProtectedRoute><CreateRoom /></ProtectedRoute>} />
        <Route path="/join/:id" element={<ProtectedRoute><JoinRoom /></ProtectedRoute>} />
        <Route path="/rooms/:id" element={<ProtectedRoute><RoomDetail /></ProtectedRoute>} />
        <Route path="/matches" element={<ProtectedRoute><MyMatches /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<ProtectedRoute admin><Admin /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return <BrowserRouter><AppRoutes /></BrowserRouter>;
}
