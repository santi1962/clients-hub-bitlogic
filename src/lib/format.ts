// Helpers de formato de fecha/moneda usados en todo el admin y el portal.

// hydration-safe: parse YYYY-MM-DD como fecha LOCAL, nunca UTC
function parseLocalDate(d: string): Date {
  const [y, m, day] = d.split("T")[0].split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, day ?? 1);
}

export function formatMoney(n: number, currency = "ARS") {
  const currencySymbols: Record<string, string> = {
    ARS: "$",
    USD: "USD ",
  };
  const locale = currency === "ARS" ? "es-AR" : "en-US";
  const symbol = currencySymbols[currency] || currency;
  return symbol + " " + new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n);
}

const MONTHS_ES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

export function formatDate(d?: string | null) {
  if (!d) return "—";
  const date = parseLocalDate(d);
  return `${String(date.getDate()).padStart(2, "0")} ${MONTHS_ES[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatLongDate(d?: string | null) {
  if (!d) return "—";
  const date = parseLocalDate(d);
  const MONTHS_FULL = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  return `${date.getDate()} de ${MONTHS_FULL[date.getMonth()]} de ${date.getFullYear()}`;
}

export function formatPeriod(p: string) {
  const [y, m] = p.split("-").map(Number);
  const MONTHS_FULL = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  return `${MONTHS_FULL[(m ?? 1) - 1]} ${y}`;
}
