import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatMoney(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

/**
 * Converte uma string "YYYY-MM-DD" para uma Data real do JavaScript no fuso local.
 * Essencial para usar com funções do date-fns (isBefore, isAfter, etc) sem o bug de fuso horário.
 */
export function parseLocalDate(iso: string): Date {
  if (!iso) return new Date();
  
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  
  // Usa fallback numérico seguro para evitar que o TS reclame de undefined
  // Se 'm' for undefined, ele assume 1 (Janeiro), evitando o NaN no cálculo.
  return new Date(y || new Date().getFullYear(), (m || 1) - 1, d || 1);
}

export function formatDate(iso: string): string {
  if (!iso) return "-";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function daysUntil(iso: string, today = new Date()): number {
  const target = new Date(`${iso.slice(0, 10)}T00:00:00`);
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target.getTime() - base.getTime()) / 86_400_000);
}

export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const date = new Date(y!, (m! - 1) + months, 1);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(d!, lastDay));
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mm}-${dd}`;
}

export function todayIso(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${mm}-${dd}`;
}

export function formatDocument(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  } else {
    return digits
      .substring(0, 14)
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1/$2")
      .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  }
}