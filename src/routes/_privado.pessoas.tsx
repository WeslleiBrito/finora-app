import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Building2, Plus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { peopleQuery } from "@/lib/api/queries";
import { PhoneDTO, PhoneType } from "@/lib/api/types";
import { api } from "@/lib/api/store";

export const Route = createFileRoute("/_privado/pessoas")({
    head: () => ({
        meta: [
            { title: "Pessoas e Empresas — Poupi" },
            { name: "description", content: "Gerencie seus clientes e fornecedores." },
        ],
    }),
    component: PeoplePage,
});

function PeoplePage() {
    const queryClient = useQueryClient();
    const people = useQuery(peopleQuery);
    const [tab, setTab] = useState("lista");

    // Estados Base
    const [kind, setKind] = useState<"INDIVIDUAL" | "LEGAL_ENTITY">("INDIVIDUAL");
    const [name, setName] = useState("");
    const [document, setDocument] = useState(""); // CPF ou CNPJ
    const [nickname, setNickname] = useState(""); // Apelido ou Nome Fantasia

    // Estados Dinâmicos (Listas)
    const [emails, setEmails] = useState([{ email: "" }]);
    const [phones, setPhones] = useState<PhoneDTO[]>([{ number: "", type: "MOBILE" }]);
    const [addresses, setAddresses] = useState([
        { street: "", number: "", neighborhood: "", complement: "", city: "", state: "", zipCode: "" }
    ]);

    const resetForm = () => {
        setName(""); setDocument(""); setNickname("");
        setEmails([{ email: "" }]);
        setPhones([{ number: "", type: "MOBILE" }]);
        setAddresses([{ street: "", number: "", neighborhood: "", complement: "", city: "", state: "", zipCode: "" }]);
    };

    const create = useMutation({
        mutationFn: () => {
            // 1. Limpa campos vazios antes de enviar
            const validEmails = emails.filter((e) => e.email.trim() !== "");
            const validPhones = phones.filter((p) => p.number.trim() !== "");
            const validAddresses = addresses.filter((a) => a.street.trim() !== "" && a.zipCode.trim() !== "");

            // 2. Monta o payload base comum às duas DTOs
            const basePayload = {
                name,
                addressesList: validAddresses,
                phoneList: validPhones,
                emailList: validEmails,
            };

            // 3. Monta o DTO final e chama a função unificada da API
            if (kind === "INDIVIDUAL") {
                return api.createPerson({
                    ...basePayload,
                    CPF: document, // Corrigido para bater com o DTO do Java
                    nickname: nickname,
                });
            } else {
                return api.createPerson({
                    ...basePayload,
                    CNPJ: document, // Corrigido para bater com o DTO do Java
                    tradeName: nickname,
                });
            }
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["people"] });
            toast.success("Cadastro realizado com sucesso!");
            resetForm();
            setTab("lista");
        },
        onError: (err: any) => toast.error(err.message),
    });

    return (
        <>
            <PageHeader
                title="Pessoas e Empresas"
                description="Gerencie seus clientes, fornecedores e parceiros de negócio."
            />

            <Tabs value={tab} onValueChange={setTab} className="mt-6">
                <TabsList>
                    <TabsTrigger value="lista">Cadastrados</TabsTrigger>
                    <TabsTrigger value="novo">Novo Cadastro</TabsTrigger>
                </TabsList>

                {/* ABA 1: LISTAGEM */}
                <TabsContent value="lista" className="mt-6 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {(people.data ?? []).map((person) => (
                            <div key={person.id} className="flex flex-col justify-between rounded-2xl border bg-card p-5 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className={`flex size-10 items-center justify-center rounded-xl ${person.personType === "INDIVIDUAL" ? "bg-primary/10 text-primary" : "bg-grape-soft text-grape"}`}>
                                        {person.personType === "INDIVIDUAL" ? <UserRound className="size-5" /> : <Building2 className="size-5" />}
                                    </div>
                                    <div>
                                        <h3 className="font-bold">{person.nickname || person.name}</h3>
                                        <p className="text-xs text-muted-foreground">{person.document}</p>
                                    </div>
                                </div>
                                <div className="mt-4 text-xs text-muted-foreground">
                                    <p className="truncate">{person.name}</p>
                                </div>
                            </div>
                        ))}
                        {people.data?.length === 0 && (
                            <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
                                Nenhuma pessoa ou empresa cadastrada ainda.
                            </p>
                        )}
                    </div>
                </TabsContent>

                {/* ABA 2: FORMULÁRIO */}
                <TabsContent value="novo" className="mt-6">
                    <div className="rounded-2xl border bg-card p-6 shadow-sm">

                        {/* DADOS BÁSICOS */}
                        <div className="mb-6 space-y-4">
                            <h2 className="text-lg font-bold">Dados Principais</h2>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Tipo de Cadastro</Label>
                                    <Select value={kind} onValueChange={(v) => setKind(v as "INDIVIDUAL" | "LEGAL_ENTITY")}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="PHYSICAL">Pessoa Física (CPF)</SelectItem>
                                            <SelectItem value="LEGAL">Pessoa Jurídica (CNPJ)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>{kind === "INDIVIDUAL" ? "Nome Completo" : "Razão Social"}</Label>
                                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Obrigatório" />
                                </div>
                                <div className="space-y-2">
                                    <Label>{kind === "INDIVIDUAL" ? "CPF" : "CNPJ"}</Label>
                                    <Input value={document} onChange={(e) => setDocument(e.target.value)} placeholder="Apenas números" />
                                </div>
                                <div className="space-y-2">
                                    <Label>{kind === "INDIVIDUAL" ? "Apelido" : "Nome Fantasia"}</Label>
                                    <Input value={nickname} onChange={(e) => setNickname(e.target.value)} />
                                </div>
                            </div>
                        </div>

                        {/* CONTATOS */}
                        <div className="mb-6 grid gap-6 border-t pt-6 lg:grid-cols-2">
                            {/* E-mails */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold">E-mails</h3>
                                    <Button variant="ghost" size="sm" onClick={() => setEmails([...emails, { email: "" }])}>
                                        <Plus className="mr-1 size-4" /> Adicionar
                                    </Button>
                                </div>
                                {emails.map((e, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <Input
                                            placeholder="exemplo@email.com"
                                            value={e.email}
                                            onChange={(ev) => {
                                                setEmails(emails.map((item, i) =>
                                                    i === idx ? { ...item, email: ev.target.value } : item
                                                ));
                                            }}
                                        />
                                        <Button variant="outline" size="icon" onClick={() => setEmails(emails.filter((_, i) => i !== idx))}>
                                            <Trash2 className="size-4 text-destructive" />
                                        </Button>
                                    </div>
                                ))}
                            </div>

                            {/* Telefones */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold">Telefones</h3>
                                    <Button variant="ghost" size="sm" onClick={() => setPhones([...phones, { number: "", type: "MOBILE" }])}>
                                        <Plus className="mr-1 size-4" /> Adicionar
                                    </Button>
                                </div>
                                {phones.map((p, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <Select
                                            value={p.type}
                                            onValueChange={(val) => {
                                                setPhones(phones.map((item, i) =>
                                                    i === idx ? { ...item, type: val as PhoneType } : item
                                                ));
                                            }}
                                        >
                                            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="MOBILE">Celular</SelectItem>
                                                <SelectItem value="LANDLINE">Fixo</SelectItem>
                                                <SelectItem value="COMMERCIAL">Comercial</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Input
                                            placeholder="(99) 99999-9999"
                                            value={p.number}
                                            onChange={(ev) => {
                                                setPhones(phones.map((item, i) =>
                                                    i === idx ? { ...item, number: ev.target.value } : item
                                                ));
                                            }}
                                        />
                                        <Button variant="outline" size="icon" onClick={() => setPhones(phones.filter((_, i) => i !== idx))}>
                                            <Trash2 className="size-4 text-destructive" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ENDEREÇOS */}
                        <div className="mb-6 space-y-4 border-t pt-6">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold">Endereços</h3>
                                <Button variant="outline" size="sm" onClick={() => setAddresses([...addresses, { street: "", number: "", neighborhood: "", complement: "", city: "", state: "", zipCode: "" }])}>
                                    <Plus className="mr-1 size-4" /> Novo Endereço
                                </Button>
                            </div>

                            {addresses.map((addr, idx) => (
                                <div key={idx} className="relative rounded-xl border bg-secondary/20 p-4">
                                    <Button
                                        variant="ghost" size="icon" className="absolute right-2 top-2 text-destructive"
                                        onClick={() => setAddresses(addresses.filter((_, i) => i !== idx))}
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                    <div className="grid gap-3 sm:grid-cols-6 pr-8">
                                        <div className="space-y-1 sm:col-span-2">
                                            <Label className="text-xs">CEP</Label>
                                            <Input 
                                                value={addr.zipCode} 
                                                onChange={(e) => setAddresses(addresses.map((a, i) => i === idx ? { ...a, zipCode: e.target.value } : a))} 
                                                placeholder="00000-000" 
                                            />
                                        </div>
                                        <div className="space-y-1 sm:col-span-4">
                                            <Label className="text-xs">Rua</Label>
                                            <Input 
                                                value={addr.street} 
                                                onChange={(e) => setAddresses(addresses.map((a, i) => i === idx ? { ...a, street: e.target.value } : a))} 
                                            />
                                        </div>
                                        <div className="space-y-1 sm:col-span-2">
                                            <Label className="text-xs">Número</Label>
                                            <Input 
                                                value={addr.number} 
                                                onChange={(e) => setAddresses(addresses.map((a, i) => i === idx ? { ...a, number: e.target.value } : a))} 
                                            />
                                        </div>
                                        <div className="space-y-1 sm:col-span-2">
                                            <Label className="text-xs">Bairro</Label>
                                            <Input 
                                                value={addr.neighborhood} 
                                                onChange={(e) => setAddresses(addresses.map((a, i) => i === idx ? { ...a, neighborhood: e.target.value } : a))} 
                                            />
                                        </div>
                                        <div className="space-y-1 sm:col-span-2">
                                            <Label className="text-xs">Complemento</Label>
                                            <Input 
                                                value={addr.complement} 
                                                onChange={(e) => setAddresses(addresses.map((a, i) => i === idx ? { ...a, complement: e.target.value } : a))} 
                                            />
                                        </div>
                                        <div className="space-y-1 sm:col-span-3">
                                            <Label className="text-xs">Cidade</Label>
                                            <Input 
                                                value={addr.city} 
                                                onChange={(e) => setAddresses(addresses.map((a, i) => i === idx ? { ...a, city: e.target.value } : a))} 
                                            />
                                        </div>
                                        <div className="space-y-1 sm:col-span-3">
                                            <Label className="text-xs">Estado (UF)</Label>
                                            <Input 
                                                value={addr.state} 
                                                onChange={(e) => setAddresses(addresses.map((a, i) => i === idx ? { ...a, state: e.target.value } : a))} 
                                                placeholder="SP, BA..." 
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <Button
                            className="w-full rounded-full lg:w-auto" size="lg"
                            disabled={!name || !document || create.isPending}
                            onClick={() => create.mutate()}
                        >
                            {create.isPending ? "Salvando..." : "Salvar Cadastro"}
                        </Button>
                    </div>
                </TabsContent>
            </Tabs>
        </>
    );
}