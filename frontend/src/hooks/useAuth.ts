import { BACKEND_URL } from "@/lib/constant";
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
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/user`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Unauthorized");
      const userData = await response.json();
      setUser(userData);
      localStorage.setItem("user", JSON.stringify(userData));
    } catch (error) {
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
    console.log(BACKEND_URL);
    if (!user) {
      window.location.href = `${BACKEND_URL}/api/auth/github`;
    }
  };

  const logout = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/auth/logout`, {
        credentials: "include",
      });
      setUser(null);
      localStorage.removeItem("user");
      navigate("/logout");
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  return { user, loading, loginWithGithub, logout };
};

export default useAuth;
