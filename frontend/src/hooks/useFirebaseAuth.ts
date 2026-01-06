import { useContext } from "react";
import { FirebaseAuthContext } from "@/contexts/FirebaseAuthContext";

const useFirebaseAuth = () => {
  const context = useContext(FirebaseAuthContext);

  if (context === undefined) {
    throw new Error(
      "useFirebaseAuth must be used within a FirebaseAuthProvider"
    );
  }

  return context;
};

export default useFirebaseAuth;
