import { BACKEND_URL } from "@/lib/constant";
import { authHeaders, clearToken, getToken } from "@/lib/api";
import type { User } from "@/types";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const useAuth = () => {
  const [user, setUser] = useState<User | null>(() => {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchUser = async () => {
    // No token => not logged in; skip the request.
    if (!getToken()) {
      localStorage.removeItem("user");
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/user`, {
        headers: { ...authHeaders() },
      });
      if (!response.ok) throw new Error("Unauthorized");
      const userData = await response.json();
      setUser(userData);
      localStorage.setItem("user", JSON.stringify(userData));
    } catch (error) {
      clearToken();
      localStorage.removeItem("user");
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const loginWithGithub = () => {
    if (!user) {
      window.location.href = `${BACKEND_URL}/api/auth/github`;
    }
  };

  const logout = async () => {
    clearToken();
    localStorage.removeItem("user");
    setUser(null);
    navigate("/");
  };

  return { user, loading, loginWithGithub, logout };
};

export default useAuth;
