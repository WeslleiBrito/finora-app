import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase"; 

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Poupi" },
      { name: "description", content: "Acesse sua conta Poupi e veja seu resumo financeiro do mês." },
      { property: "og:title", content: "Entrar — Poupi" },
      { property: "og:description", content: "Acesse sua conta Poupi e veja seu resumo financeiro do mês." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {

  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setLoading(true);
    try {
      // Login real no Firebase!
      await signInWithEmailAndPassword(auth, email, password);
      toast.success("Login realizado com sucesso!");
      void navigate({ to: "/dashboard" });
    } catch (error: any) {
      toast.error("Erro ao fazer login: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Bem-vindo de volta" subtitle="Entre para continuar cuidando do seu dinheiro.">
      <form
        className="space-y-4"
        onSubmit={handleLogin}
      >
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
          />
        </div>
        <Button type="submit" className="w-full rounded-full" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Ainda não tem conta?{" "}
        <Link to="/cadastro" className="font-semibold text-primary">
          Criar agora
        </Link>
      </p>
    </AuthLayout>
  );
}

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </span>
          <span className="font-display text-lg font-bold">Poupi</span>
        </Link>
        <div className="rounded-3xl border bg-card p-7 shadow-sm">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
