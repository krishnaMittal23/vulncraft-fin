import useAuth from "@/hooks/useAuth";
import { Navigate, Outlet } from "react-router-dom";
import LoadingScreen from "../shared/Loading";

const PrivateRoute = () => {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  return user ? <Outlet /> : <Navigate to="/" />;
};

export default PrivateRoute;
