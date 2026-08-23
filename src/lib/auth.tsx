import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut, User } from "firebase/auth";
import { auth } from "./firebase";

export interface AppUser {
  name: string;
  email: string;
  uid: string;
}

interface AuthState {
  user: AppUser | null;
  ready: boolean;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // O Firebase avisa automaticamente quando o usuário loga ou desloga
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: User | null) => {
      if (firebaseUser) {
        setUser({
          name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Usuário",
          email: firebaseUser.email || "",
          uid: firebaseUser.uid,
        });
      } else {
        setUser(null);
      }
      setReady(true);
    });

    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  // Função utilitária para pegar o token fresquinho antes de chamar a API Spring Boot
  const getToken = async () => {
    if (!auth.currentUser) return null;
    return await auth.currentUser.getIdToken(false);
  };

  const value = useMemo(() => ({ user, ready, signOut, getToken }), [user, ready]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de AuthProvider");
  return ctx;
}