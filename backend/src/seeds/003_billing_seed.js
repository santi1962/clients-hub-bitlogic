/**
 * Seed 003 — Datos de facturación
 * Crea avisos de pago y pagos para los servicios del seed 002.
 * Cubre meses 2026-04, 2026-05, 2026-06 con distintos estados.
 */
import pool from "../db/pool.js";

// Ambos seeds de esta fase (avisos y pagos) ya mandan id explícito
// (deterministas, ver N()/P() abajo), así que INSERT IGNORE reproduce
// exactamente "ya existe -> no hacer nada".
const INSERT_NOTICE_SQL = `INSERT IGNORE INTO payment_notices (id, client_id, hosting_service_id, notice_number, period_month, period_year, issue_date, due_date, amount, status, sent_at, paid_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`;

const INSERT_PAYMENT_SQL = `INSERT IGNORE INTO payments (id, client_id, hosting_service_id, payment_notice_id, period_month, period_year, amount, method, status, paid_at, reference)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`;

// MariaDB exige el nombre de la secuencia como identificador sin comillas.
const SETVAL_NOTICE_SEQ_SQL = `SELECT SETVAL(payment_notice_number_seq, 20, true)`;

// Reutilizar los UUIDs deterministas del seed 002
const C = {
  c1: "22222222-2222-2222-2222-000000000001", // Café del Valle
  c2: "22222222-2222-2222-2222-000000000002", // Estudio Acosta
  c3: "22222222-2222-2222-2222-000000000003", // MundoFit
  c4: "22222222-2222-2222-2222-000000000004", // Logisur SRL
  c5: "22222222-2222-2222-2222-000000000005", // Belladermo
  c6: "22222222-2222-2222-2222-000000000006", // Luna Arquitectos
  c8: "22222222-2222-2222-2222-000000000008", // Tienda Méndez
};

const S = {
  s1: "33333333-3333-3333-3333-000000000001", // cafedelvalle.com
  s2: "33333333-3333-3333-3333-000000000002", // estudioacosta.com.ar
  s3: "33333333-3333-3333-3333-000000000003", // mundofit.com
  s4: "33333333-3333-3333-3333-000000000004", // tienda.mundofit.com
  s5: "33333333-3333-3333-3333-000000000005", // logisur.com
  s6: "33333333-3333-3333-3333-000000000006", // belladermo.com
  s7: "33333333-3333-3333-3333-000000000007", // blog.belladermo.com
  s8: "33333333-3333-3333-3333-000000000008", // luna-arquitectos.com
  s10: "33333333-3333-3333-3333-000000000010", // tiendamendez.com
  s11: "33333333-3333-3333-3333-000000000011", // blog.estudioacosta.com.ar
  s12: "33333333-3333-3333-3333-000000000012", // intranet.logisur.com
};

const N = (n) => `44444444-4444-4444-4444-${String(n).padStart(12, "0")}`;
const P = (n) => `55555555-5555-5555-5555-${String(n).padStart(12, "0")}`;

export async function run() {
  // ── Avisos de pago ──────────────────────────────────────────
  // [id, clientId, serviceId, noticeNumber, month, year, issueDate, dueDate, amount, status, sentAt, paidAt]
  const notices = [
    // Abril 2026 — mayormente pagados
    [
      N(1),
      C.c1,
      S.s1,
      "AV-2026-0001",
      4,
      2026,
      "2026-04-05",
      "2026-04-25",
      18.0,
      "paid",
      "2026-04-05",
      "2026-04-22",
    ],
    [
      N(2),
      C.c2,
      S.s2,
      "AV-2026-0002",
      4,
      2026,
      "2026-04-05",
      "2026-04-30",
      8.0,
      "paid",
      "2026-04-05",
      "2026-04-28",
    ],
    [
      N(3),
      C.c4,
      S.s5,
      "AV-2026-0003",
      4,
      2026,
      "2026-04-03",
      "2026-04-20",
      35.0,
      "paid",
      "2026-04-03",
      "2026-04-15",
    ],
    [
      N(4),
      C.c5,
      S.s6,
      "AV-2026-0004",
      4,
      2026,
      "2026-04-05",
      "2026-04-25",
      18.0,
      "paid",
      "2026-04-05",
      "2026-04-20",
    ],
    [
      N(5),
      C.c6,
      S.s8,
      "AV-2026-0005",
      4,
      2026,
      "2026-04-05",
      "2026-04-28",
      8.0,
      "paid",
      "2026-04-05",
      "2026-04-25",
    ],
    [
      N(6),
      C.c8,
      S.s10,
      "AV-2026-0006",
      4,
      2026,
      "2026-04-08",
      "2026-04-30",
      18.0,
      "paid",
      "2026-04-08",
      "2026-04-27",
    ],
    // Mayo 2026 — mezcla de pagados y vencidos
    [
      N(7),
      C.c1,
      S.s1,
      "AV-2026-0007",
      5,
      2026,
      "2026-05-05",
      "2026-05-25",
      18.0,
      "paid",
      "2026-05-05",
      "2026-05-20",
    ],
    [
      N(8),
      C.c3,
      S.s3,
      "AV-2026-0008",
      5,
      2026,
      "2026-05-05",
      "2026-05-25",
      18.0,
      "paid",
      "2026-05-05",
      "2026-05-18",
    ],
    [
      N(9),
      C.c4,
      S.s5,
      "AV-2026-0009",
      5,
      2026,
      "2026-05-03",
      "2026-05-20",
      35.0,
      "paid",
      "2026-05-03",
      "2026-05-12",
    ],
    [
      N(10),
      C.c8,
      S.s10,
      "AV-2026-0010",
      5,
      2026,
      "2026-05-08",
      "2026-05-30",
      18.0,
      "paid",
      "2026-05-08",
      "2026-05-25",
    ],
    [
      N(11),
      C.c2,
      S.s11,
      "AV-2026-0011",
      5,
      2026,
      "2026-05-10",
      "2026-05-30",
      8.0,
      "overdue",
      "2026-05-10",
      null,
    ],
    [
      N(12),
      C.c4,
      S.s12,
      "AV-2026-0012",
      5,
      2026,
      "2026-05-10",
      "2026-06-01",
      8.0,
      "overdue",
      "2026-05-10",
      null,
    ],
    [
      N(13),
      C.c5,
      S.s7,
      "AV-2026-0013",
      5,
      2026,
      "2026-05-05",
      "2026-05-20",
      8.0,
      "overdue",
      "2026-05-05",
      null,
    ],
    // Junio 2026 — mes actual, varios pendientes/enviados
    [
      N(14),
      C.c1,
      S.s1,
      "AV-2026-0014",
      6,
      2026,
      "2026-06-05",
      "2026-06-25",
      18.0,
      "sent",
      "2026-06-05",
      null,
    ],
    [
      N(15),
      C.c3,
      S.s3,
      "AV-2026-0015",
      6,
      2026,
      "2026-06-05",
      "2026-06-20",
      18.0,
      "sent",
      "2026-06-05",
      null,
    ],
    [
      N(16),
      C.c3,
      S.s4,
      "AV-2026-0016",
      6,
      2026,
      "2026-06-05",
      "2026-06-18",
      8.0,
      "pending",
      null,
      null,
    ],
    [
      N(17),
      C.c4,
      S.s5,
      "AV-2026-0017",
      6,
      2026,
      "2026-06-03",
      "2026-07-10",
      35.0,
      "paid",
      "2026-06-03",
      "2026-06-06",
    ],
    [
      N(18),
      C.c5,
      S.s6,
      "AV-2026-0018",
      6,
      2026,
      "2026-06-05",
      "2026-06-22",
      18.0,
      "sent",
      "2026-06-05",
      null,
    ],
    [
      N(19),
      C.c6,
      S.s8,
      "AV-2026-0019",
      6,
      2026,
      "2026-06-05",
      "2026-06-28",
      8.0,
      "sent",
      "2026-06-05",
      null,
    ],
    [
      N(20),
      C.c8,
      S.s10,
      "AV-2026-0020",
      6,
      2026,
      "2026-06-08",
      "2026-07-05",
      18.0,
      "paid",
      "2026-06-08",
      "2026-06-10",
    ],
  ];

  for (const [
    id,
    clientId,
    serviceId,
    noticeNumber,
    month,
    year,
    issueDate,
    dueDate,
    amount,
    status,
    sentAt,
    paidAt,
  ] of notices) {
    await pool.query(
      INSERT_NOTICE_SQL,
      [
        id,
        clientId,
        serviceId,
        noticeNumber,
        month,
        year,
        issueDate,
        dueDate,
        amount,
        status,
        sentAt,
        paidAt,
      ],
    );
  }
  console.log("  ✓ Avisos de pago: 20 registros");

  // ── Pagos ──────────────────────────────────────────────────
  // [id, clientId, serviceId, noticeId, month, year, amount, method, status, paidAt, reference]
  const payments = [
    // Abril 2026
    [P(1), C.c1, S.s1, N(1), 4, 2026, 18.0, "transfer", "paid", "2026-04-22", "TR-001"],
    [P(2), C.c2, S.s2, N(2), 4, 2026, 8.0, "mercadopago", "paid", "2026-04-28", "MP-10231"],
    [P(3), C.c4, S.s5, N(3), 4, 2026, 35.0, "transfer", "paid", "2026-04-15", "TR-002"],
    [P(4), C.c5, S.s6, N(4), 4, 2026, 18.0, "mercadopago", "paid", "2026-04-20", "MP-10298"],
    [P(5), C.c6, S.s8, N(5), 4, 2026, 8.0, "transfer", "paid", "2026-04-25", "TR-003"],
    [P(6), C.c8, S.s10, N(6), 4, 2026, 18.0, "paypal", "paid", "2026-04-27", "PP-5671"],
    // Mayo 2026
    [P(7), C.c1, S.s1, N(7), 5, 2026, 18.0, "transfer", "paid", "2026-05-20", "TR-010"],
    [P(8), C.c3, S.s3, N(8), 5, 2026, 18.0, "paypal", "paid", "2026-05-18", "PP-5690"],
    [P(9), C.c4, S.s5, N(9), 5, 2026, 35.0, "transfer", "paid", "2026-05-12", "TR-011"],
    [P(10), C.c8, S.s10, N(10), 5, 2026, 18.0, "mercadopago", "paid", "2026-05-25", "MP-10450"],
    // Junio 2026
    [P(11), C.c4, S.s5, N(17), 6, 2026, 35.0, "transfer", "paid", "2026-06-06", "TR-020"],
    [P(12), C.c8, S.s10, N(20), 6, 2026, 18.0, "paypal", "paid", "2026-06-10", "PP-5710"],
  ];

  for (const [
    id,
    clientId,
    serviceId,
    noticeId,
    month,
    year,
    amount,
    method,
    status,
    paidAt,
    reference,
  ] of payments) {
    await pool.query(INSERT_PAYMENT_SQL, [
      id, clientId, serviceId, noticeId, month, year, amount, method, status, paidAt, reference,
    ]);
  }
  console.log("  ✓ Pagos: 12 registros");

  // Avanzar la secuencia de avisos para que los nuevos empiecen en 21
  await pool.query(SETVAL_NOTICE_SEQ_SQL);
  console.log("  ✓ Secuencia de avisos en 20 (próximo: AV-...-0021)");
}
