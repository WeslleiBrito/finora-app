import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "./login";
import { toast } from "sonner";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "@/lib/firebase"; // 👈 padronizado para "auth"

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar conta — Poupi" },
      { name: "description", content: "Crie sua conta no Poupi e comece a organizar suas finanças hoje." },
      { property: "og:title", content: "Criar conta — Poupi" },
      { property: "og:description", content: "Crie sua conta no Poupi e comece a organizar suas finanças hoje." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Cria o usuário no Firebase
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // 2. Salva o nome no perfil do Firebase
      await updateProfile(userCredential.user, { displayName: name });

      toast.success("Conta criada!");
      void navigate({ to: "/dashboard" });
    } catch (error: any) {
      toast.error("Erro no cadastro: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 👇 NOVO: Cadastro com Google
  const handleGoogleSignup = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);

      // O Google já preenche displayName e email automaticamente
      toast.success(`Bem-vindo, ${result.user.displayName}!`);
      void navigate({ to: "/dashboard" });
    } catch (error: any) {
      toast.error("Erro ao entrar com Google: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Criar sua conta" subtitle="Leva menos de um minuto para começar.">
      <form className="space-y-4" onSubmit={handleCadastro}>
        <div className="space-y-2">
          <Label htmlFor="name">Nome</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
        <Button type="submit" className="w-full rounded-full" disabled={loading}>
          {loading ? "Criando..." : "Criar conta"}
        </Button>
      </form>

      {/* 👇 NOVO: Divisor + botão Google */}
      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">ou</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full rounded-full"
        onClick={handleGoogleSignup}
        disabled={loading}
      >
        <GoogleIcon className="mr-2 size-4" />
        Criar com Google
      </Button>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link to="/login" className="font-semibold text-primary">
          Entrar
        </Link>
      </p>
    </AuthLayout>
  );
}

// 👇 NOVO: Ícone do Google
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A10.97 10.97 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
    </svg>
  );
}
