import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { PageHeader } from "@/components/app/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { TabPessoas } from "@/components/cadastros/tab-pessoas";
import { TabTipos } from "@/components/cadastros/tab-tipos";
import { TabGrupos } from "@/components/cadastros/tab-grupos";
import { TabBandeiras } from "@/components/cadastros/tab-bandeiras";
import { TabBancos } from "@/components/cadastros/tab-bancos";

export const Route = createFileRoute("/_privado/cadastros")({
  head: () => ({
    meta: [
      { title: "Cadastros — Poupi" },
      { name: "description", content: "Bancos, bandeiras, grupos, tipos de operação e pessoas." },
    ],
  }),
  component: RegistriesPage,
});

function RegistriesPage() {
  const [tab, setTab] = useState("tipos");

  return (
    <>
      <PageHeader
        title="Cadastros Básicos"
        description="Gerencie as tabelas que alimentam o sistema."
      />

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="tipos">Tipos de operação</TabsTrigger>
          <TabsTrigger value="grupos">Grupos</TabsTrigger>
          <TabsTrigger value="pessoas">Pessoas</TabsTrigger>
          <TabsTrigger value="bancos">Bancos</TabsTrigger>
          <TabsTrigger value="bandeiras">Bandeiras</TabsTrigger>
        </TabsList>

        <TabsContent value="tipos" className="mt-6"><TabTipos /></TabsContent>
        <TabsContent value="grupos" className="mt-6"><TabGrupos /></TabsContent>
        <TabsContent value="pessoas" className="mt-6"><TabPessoas /></TabsContent>
        <TabsContent value="bancos" className="mt-6"><TabBancos /></TabsContent>
        <TabsContent value="bandeiras" className="mt-6"><TabBandeiras /></TabsContent>
      </Tabs>
    </>
  );
}