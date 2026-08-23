import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InteractiveList, type ListItemProps } from "@/components/app/interactive-list";

import { peopleQuery } from "@/lib/api/queries";
import { api } from "@/lib/api/store";
import type { PhoneDTO, AddressDTO, PhoneType } from "@/lib/api/types";
import { formatDocument } from "@/lib/format"; // Vamos usar a sua formatação já existente

export function TabPessoas() {
  const queryClient = useQueryClient();
  const people = useQuery(peopleQuery);

  const [openModal, setOpenModal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [kind, setKind] = useState<"INDIVIDUAL" | "LEGAL_ENTITY">("INDIVIDUAL");
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [nickname, setNickname] = useState("");
  const [emails, setEmails] = useState([{ email: "" }]);
  const [phones, setPhones] = useState<PhoneDTO[]>([{ number: "", type: "MOBILE" }]);
  const [addresses, setAddresses] = useState<AddressDTO[]>([{ street: "", number: "", neighborhood: "", complement: "", city: "", state: "", zipCode: "" }]);

  const resetForm = () => {
    setSelectedId(null);
    setName(""); setDocument(""); setNickname(""); setKind("INDIVIDUAL");
    setEmails([{ email: "" }]);
    setPhones([{ number: "", type: "MOBILE" }]);
    setAddresses([{ street: "", number: "", neighborhood: "", complement: "", city: "", state: "", zipCode: "" }]);
  };

  const openForEdit = (item: ListItemProps) => {
    const p = item.raw;
    setSelectedId(p.id);
    setKind(p.personType || "INDIVIDUAL");
    setName(p.name || "");
    setDocument(p.cpf || p.cnpj || "");
    setNickname(p.nickname || p.tradeName || "");
    setEmails(p.emails?.length ? p.emails : [{ email: "" }]);
    setPhones(p.phones?.length ? p.phones : [{ number: "", type: "MOBILE" }]);
    setAddresses(p.addresses?.length ? p.addresses : [{ street: "", number: "", neighborhood: "", complement: "", city: "", state: "", zipCode: "" }]);
    setOpenModal(true);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const validEmails = emails.filter((e) => e.email.trim() !== "");
      const validPhones = phones.filter((p) => p.number.trim() !== "");
      const validAddresses = addresses.filter((a) => a.street.trim() !== "" && a.zipCode.trim() !== "");

      const payload = { name, nickname, addressesList: validAddresses, phoneList: validPhones, emailList: validEmails };
      const isLegal = kind === "LEGAL_ENTITY";
      const finalPayload = isLegal 
        ? { ...payload, CNPJ: document, tradeName: nickname, personType: "LEGAL_ENTITY" } 
        : { ...payload, CPF: document, personType: "INDIVIDUAL" };

      return selectedId ? api.updatePerson(selectedId, finalPayload) : api.createPerson(finalPayload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["people"] });
      toast.success(selectedId ? "Pessoa atualizada!" : "Pessoa cadastrada!");
      setOpenModal(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { resetForm(); setOpenModal(true); }} className="rounded-full">
          <Plus className="mr-2 size-4" /> Nova Pessoa
        </Button>
      </div>

      <InteractiveList
        items={(people.data ?? []).map((p) => ({
          id: p.id,
          title: p.nickname ?? p.name,
          subtitle: `${p.personType === "INDIVIDUAL" ? "Pessoa física" : "Pessoa jurídica"} — ${formatDocument(p.cpf) || formatDocument(p.cnpj)}`,
          active: true,
          raw: { ...p, category: "pessoas" },
        }))}
        onSelect={openForEdit}
      />

      <Dialog open={openModal} onOpenChange={(val) => { setOpenModal(val); if (!val) resetForm(); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedId ? <Pencil className="size-4 text-primary" /> : <Plus className="size-4 text-primary" />}
              {selectedId ? "Editar Pessoa" : "Nova Pessoa"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo de Pessoa</Label>
                <Select value={kind} onValueChange={(v) => setKind(v as "INDIVIDUAL" | "LEGAL_ENTITY")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INDIVIDUAL">Pessoa Física</SelectItem>
                    <SelectItem value="LEGAL_ENTITY">Pessoa Jurídica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{kind === "INDIVIDUAL" ? "Nome Completo" : "Razão Social"}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{kind === "INDIVIDUAL" ? "CPF" : "CNPJ"}</Label>
                <Input value={document} onChange={(e) => setDocument(formatDocument(e.target.value) || "")} maxLength={18} />
              </div>
              <div className="space-y-2">
                <Label>{kind === "INDIVIDUAL" ? "Apelido" : "Nome Fantasia"}</Label>
                <Input value={nickname} onChange={(e) => setNickname(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-6 border-t pt-4 lg:grid-cols-2">
              {/* E-mails */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">E-mails</h3>
                  <Button variant="ghost" size="sm" onClick={() => setEmails([...emails, { email: "" }])}><Plus className="size-4" /></Button>
                </div>
                {emails.map((e, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input placeholder="exemplo@email.com" value={e.email} onChange={(ev) => setEmails(emails.map((item, i) => i === idx ? { ...item, email: ev.target.value } : item))} />
                    <Button variant="outline" size="icon" onClick={() => setEmails(emails.filter((_, i) => i !== idx))}><Trash2 className="size-4 text-destructive" /></Button>
                  </div>
                ))}
              </div>

              {/* Telefones */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Telefones</h3>
                  <Button variant="ghost" size="sm" onClick={() => setPhones([...phones, { number: "", type: "MOBILE" }])}><Plus className="size-4" /></Button>
                </div>
                {phones.map((p, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Select value={p.type} onValueChange={(val) => setPhones(phones.map((item, i) => i === idx ? { ...item, type: val as PhoneType } : item))}>
                      <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MOBILE">Celular</SelectItem>
                        <SelectItem value="LANDLINE">Fixo</SelectItem>
                        <SelectItem value="COMMERCIAL">Comercial</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input placeholder="(99) 99999-9999" value={p.number} onChange={(ev) => setPhones(phones.map((item, i) => i === idx ? { ...item, number: ev.target.value } : item))} />
                    <Button variant="outline" size="icon" onClick={() => setPhones(phones.filter((_, i) => i !== idx))}><Trash2 className="size-4 text-destructive" /></Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Endereços */}
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Endereços</h3>
                <Button variant="outline" size="sm" onClick={() => setAddresses([...addresses, { street: "", number: "", neighborhood: "", complement: "", city: "", state: "", zipCode: "" }])}><Plus className="mr-1 size-4" /> Novo</Button>
              </div>
              {addresses.map((addr, idx) => (
                <div key={idx} className="relative rounded-xl border bg-secondary/20 p-4">
                  <Button variant="ghost" size="icon" className="absolute right-2 top-2 text-destructive" onClick={() => setAddresses(addresses.filter((_, i) => i !== idx))}><Trash2 className="size-4" /></Button>
                  <div className="grid gap-3 sm:grid-cols-6 pr-8">
                    <div className="space-y-1 sm:col-span-2"><Label className="text-xs">CEP</Label><Input value={addr.zipCode} onChange={(e) => setAddresses(addresses.map((a, i) => i === idx ? { ...a, zipCode: e.target.value } : a))} placeholder="00000-000" /></div>
                    <div className="space-y-1 sm:col-span-4"><Label className="text-xs">Rua</Label><Input value={addr.street} onChange={(e) => setAddresses(addresses.map((a, i) => i === idx ? { ...a, street: e.target.value } : a))} /></div>
                    <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Número</Label><Input value={addr.number} onChange={(e) => setAddresses(addresses.map((a, i) => i === idx ? { ...a, number: e.target.value } : a))} /></div>
                    <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Bairro</Label><Input value={addr.neighborhood} onChange={(e) => setAddresses(addresses.map((a, i) => i === idx ? { ...a, neighborhood: e.target.value } : a))} /></div>
                    <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Complemento</Label><Input value={addr.complement} onChange={(e) => setAddresses(addresses.map((a, i) => i === idx ? { ...a, complement: e.target.value } : a))} /></div>
                    <div className="space-y-1 sm:col-span-3"><Label className="text-xs">Cidade</Label><Input value={addr.city} onChange={(e) => setAddresses(addresses.map((a, i) => i === idx ? { ...a, city: e.target.value } : a))} /></div>
                    <div className="space-y-1 sm:col-span-3"><Label className="text-xs">Estado</Label><Input value={addr.state} onChange={(e) => setAddresses(addresses.map((a, i) => i === idx ? { ...a, state: e.target.value } : a))} placeholder="SP, BA..." /></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenModal(false)} className="rounded-full">Cancelar</Button>
            <Button disabled={!name || !document || saveMutation.isPending} onClick={() => saveMutation.mutate()} className="rounded-full">
              {saveMutation.isPending ? "Salvando..." : "Salvar no Banco"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}