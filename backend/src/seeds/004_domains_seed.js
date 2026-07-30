import { randomUUID } from "crypto";
import pool from "../db/pool.js";
import config from "../config/index.js";

// ON CONFLICT DO NOTHING (Postgres) vs INSERT IGNORE (MariaDB) — mismo
// criterio de branching por config.db.driver que seeds/001_admin_seed.js.
const INSERT_DOMAIN_SQL =
  config.db.driver === "mysql"
    ? `INSERT IGNORE INTO domains (id, client_id, hosting_service_id, domain, registrar, registration_date, expiration_date, annual_cost, customer_price, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    : `INSERT INTO domains (id, client_id, hosting_service_id, domain, registrar, registration_date, expiration_date, annual_cost, customer_price, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT DO NOTHING`;

const CLIENTS = [
  "22222222-2222-2222-2222-000000000001",
  "22222222-2222-2222-2222-000000000002",
  "22222222-2222-2222-2222-000000000003",
  "22222222-2222-2222-2222-000000000004",
  "22222222-2222-2222-2222-000000000005",
  "22222222-2222-2222-2222-000000000006",
];

const SERVICES = [
  "33333333-3333-3333-3333-000000000001",
  "33333333-3333-3333-3333-000000000002",
  "33333333-3333-3333-3333-000000000003",
  "33333333-3333-3333-3333-000000000004",
  "33333333-3333-3333-3333-000000000005",
  "33333333-3333-3333-3333-000000000006",
];

const DOMAINS = [
  // C1 - 2 dominios
  {
    domain: "empresa1.com.ar",
    client: CLIENTS[0],
    service: SERVICES[0],
    status: "active",
    expiration: "2027-03-15",
    registrar: "NIC.ar",
    annualCost: 500,
    customerPrice: 800,
  },
  {
    domain: "tienda1.com.ar",
    client: CLIENTS[0],
    service: SERVICES[1],
    status: "due_soon",
    expiration: "2026-07-20",
    registrar: "NIC.ar",
    annualCost: 500,
    customerPrice: 800,
  },

  // C2 - 2 dominios
  {
    domain: "consultoria2.com",
    client: CLIENTS[1],
    service: SERVICES[2],
    status: "active",
    expiration: "2027-06-10",
    registrar: "GoDaddy",
    annualCost: 600,
    customerPrice: 1000,
  },
  {
    domain: "web2.com.ar",
    client: CLIENTS[1],
    service: null,
    status: "expired",
    expiration: "2026-01-05",
    registrar: "NIC.ar",
    annualCost: 500,
    customerPrice: 800,
  },

  // C3 - 2 dominios
  {
    domain: "industria3.com.ar",
    client: CLIENTS[2],
    service: SERVICES[3],
    status: "active",
    expiration: "2028-02-28",
    registrar: "NIC.ar",
    annualCost: 500,
    customerPrice: 800,
  },
  {
    domain: "exporta3.net",
    client: CLIENTS[2],
    service: SERVICES[4],
    status: "due_soon",
    expiration: "2026-08-12",
    registrar: "Namecheap",
    annualCost: 450,
    customerPrice: 750,
  },

  // C4 - 2 dominios
  {
    domain: "servicio4.com.ar",
    client: CLIENTS[3],
    service: SERVICES[5],
    status: "active",
    expiration: "2027-11-30",
    registrar: "NIC.ar",
    annualCost: 500,
    customerPrice: 800,
  },
  {
    domain: "blog4.com",
    client: CLIENTS[3],
    service: null,
    status: "active",
    expiration: "2026-12-25",
    registrar: "Bluehost",
    annualCost: 350,
    customerPrice: 600,
  },

  // C5 - 1 dominio
  {
    domain: "negocio5.com.ar",
    client: CLIENTS[4],
    service: null,
    status: "expired",
    expiration: "2025-09-18",
    registrar: "NIC.ar",
    annualCost: 500,
    customerPrice: 800,
  },

  // C6 - 1 dominio
  {
    domain: "comercio6.com.ar",
    client: CLIENTS[5],
    service: null,
    status: "active",
    expiration: "2027-04-05",
    registrar: "NIC.ar",
    annualCost: 500,
    customerPrice: 800,
  },
];

export async function run() {
  const client = await pool.connect();
  try {
    console.log("  Seeding domains…");

    // registration_date: NOW()::date - INTERVAL '2 years' (Postgres-only) ->
    // calculado en Node, mismo criterio que el resto de las fases.
    const registrationDate = new Date();
    registrationDate.setFullYear(registrationDate.getFullYear() - 2);

    for (const d of DOMAINS) {
      await client.query(INSERT_DOMAIN_SQL, [
        randomUUID(),
        d.client,
        d.service,
        d.domain,
        d.registrar,
        registrationDate,
        d.expiration,
        d.annualCost,
        d.customerPrice,
        d.status,
      ]);
    }

    console.log(`  ✓ Dominios: ${DOMAINS.length} registros`);
  } finally {
    client.release();
  }
}
