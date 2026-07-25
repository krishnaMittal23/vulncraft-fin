import Landing from "@/components/auth/Landing";
import LoadingScreen from "@/components/shared/Loading";
import useAuth from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";

const Auth = () => {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  if (user) {
    return <Navigate to="/dashboard" />;
  }

  return <Landing />;
};

export default Auth;
