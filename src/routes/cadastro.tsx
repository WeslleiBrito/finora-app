import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "./login";
import { toast } from "sonner";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth as firebaseAuth } from "@/lib/firebase";


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
      const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      
      // Opcional: Salvar o nome no perfil do Firebase
      await updateProfile(userCredential.user, { displayName: name });

      // 2. Pega o Token gerado
      const token = await userCredential.user.getIdToken();

      // 3. Envia para o Spring Boot (Mude localhost pelo seu IP ou URL da API se necessário)
      const response = await fetch("https://constraint-five-eds-ciao.trycloudflare.com/api/users/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ name: name })
      });

      if (!response.ok) throw new Error("Falha ao sincronizar com o banco de dados");

      toast.success("Conta criada e sincronizada com sucesso!");
      void navigate({ to: "/dashboard" });

    } catch (error: any) {
      toast.error("Erro no cadastro: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Criar sua conta" subtitle="Leva menos de um minuto para começar.">
      <form
        className="space-y-4"
        onSubmit={handleCadastro}
      >
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
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link to="/login" className="font-semibold text-primary">
          Entrar
        </Link>
      </p>
    </AuthLayout>
  );
}
