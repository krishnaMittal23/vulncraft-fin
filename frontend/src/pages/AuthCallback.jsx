import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { setToken } from "@/lib/api";
import LoadingScreen from "@/components/shared/Loading";

/**
 * Lands after the GitHub OAuth redirect: stores the JWT from the query string,
 * then forwards to the dashboard. On error, returns to the login page.
 */
const AuthCallback = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = params.get("token");
    if (token) {
      setToken(token);
      // Drop any cached user so useAuth re-fetches with the new token.
      localStorage.removeItem("user");
      navigate("/dashboard", { replace: true });
    } else {
      navigate("/?error=auth_failed", { replace: true });
    }
  }, [params, navigate]);

  return <LoadingScreen />;
};

export default AuthCallback;
