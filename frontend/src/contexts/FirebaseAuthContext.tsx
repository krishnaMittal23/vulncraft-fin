import React, { createContext, useState, useEffect, ReactNode } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth } from "@/lib/firebaseConfig";
import { BACKEND_URL } from "@/lib/constant";
import type { User } from "@/types";

interface FirebaseAuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  isFirebaseAuth: boolean;
  signup: (email: string, password: string, username: string) => Promise<void>;
  login: (email: string, password: string) => Promise<string>;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  linkGithub: (githubAccessToken: string, githubProfile: any) => Promise<void>;
}

export const FirebaseAuthContext = createContext<
  FirebaseAuthContextType | undefined
>(undefined);

export const FirebaseAuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFirebaseAuth, setIsFirebaseAuth] = useState(false);

  // Listen for Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUserData) => {
      setFirebaseUser(firebaseUserData);

      if (firebaseUserData) {
        setIsFirebaseAuth(true);
        try {
          const idToken = await firebaseUserData.getIdToken();
          const response = await fetch(
            `${BACKEND_URL}/api/auth/firebase/user`,
            {
              headers: {
                Authorization: `Bearer ${idToken}`,
              },
            }
          );

          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
            localStorage.setItem("user", JSON.stringify(userData));
            localStorage.setItem("authMethod", "firebase");
          } else {
            // User doesn't exist in DB yet, that's okay
            setUser(null);
          }
        } catch (error) {
          console.error("Error fetching Firebase user:", error);
          setUser(null);
        }
      } else {
        setUser(null);
        setIsFirebaseAuth(false);
        localStorage.removeItem("user");
        localStorage.removeItem("authMethod");
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signup = async (
    email: string,
    password: string,
    username: string
  ) => {
    try {
      // Create Firebase user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      // Create user in MongoDB backend
      const response = await fetch(`${BACKEND_URL}/api/auth/firebase/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          username,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // Delete Firebase user if backend signup fails
        await userCredential.user.delete();
        throw new Error(errorData.message || "Failed to create user in database");
      }

      const userData = await response.json();
      setUser(userData.user);
      localStorage.setItem("user", JSON.stringify(userData.user));
      localStorage.setItem("authMethod", "firebase");
    } catch (error) {
      console.error("Signup error:", error);
      throw error;
    }
  };

  const login = async (email: string, password: string): Promise<string> => {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      const idToken = await userCredential.user.getIdToken();

      // Login to backend
      const response = await fetch(`${BACKEND_URL}/api/auth/firebase/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          idToken,
        }),
      });

      if (!response.ok) {
        throw new Error("Backend login failed");
      }

      const userData = await response.json();
      setUser(userData.user);
      localStorage.setItem("user", JSON.stringify(userData.user));
      localStorage.setItem("authMethod", "firebase");

      return idToken;
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
      await fetch(`${BACKEND_URL}/api/auth/logout`, {
        credentials: "include",
      });
      setUser(null);
      setFirebaseUser(null);
      localStorage.removeItem("user");
      localStorage.removeItem("authMethod");
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  };

  const getIdToken = async (): Promise<string | null> => {
    if (firebaseUser) {
      return await firebaseUser.getIdToken();
    }
    return null;
  };

  const linkGithub = async (githubAccessToken: string, githubProfile: any) => {
    try {
      const idToken = await getIdToken();

      const response = await fetch(
        `${BACKEND_URL}/api/auth/firebase/link-github`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            firebaseUid: firebaseUser?.uid,
            githubAccessToken,
            githubProfile,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to link GitHub");
      }

      const userData = await response.json();
      setUser(userData.user);
      localStorage.setItem("user", JSON.stringify(userData.user));
    } catch (error) {
      console.error("GitHub linking error:", error);
      throw error;
    }
  };

  return (
    <FirebaseAuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        isFirebaseAuth,
        signup,
        login,
        logout,
        getIdToken,
        linkGithub,
      }}
    >
      {children}
    </FirebaseAuthContext.Provider>
  );
};
