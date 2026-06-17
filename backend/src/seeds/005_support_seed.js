/**
 * Support Tickets Seed (Phase 3B)
 * Creates sample support tickets and messages for testing
 */
import { v5 as uuidv5 } from "uuid";
import pool from "../db/pool.js";

const NS_SUPPORT = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

function generateSeedId(namespace, name) {
  return uuidv5(name, namespace);
}

export async function run() {
  const client = await pool.connect();
  try {
    console.log("  Seeding support tickets...");

    // Deterministic IDs (must match 003_billing_seed.js)
    const clientIds = [
      "22222222-2222-2222-2222-000000000001", // c1
      "22222222-2222-2222-2222-000000000002", // c2
      "22222222-2222-2222-2222-000000000003", // c3
      "22222222-2222-2222-2222-000000000004", // c4
    ];

    const serviceIds = [
      "33333333-3333-3333-3333-000000000001", // s1
      "33333333-3333-3333-3333-000000000002", // s2
      "33333333-3333-3333-3333-000000000003", // s3
      "33333333-3333-3333-3333-000000000004", // s4
    ];

    const staffId = "11111111-1111-1111-1111-111111111111"; // admin user

    const tickets = [
      {
        id: generateSeedId(NS_SUPPORT, "tk-001"),
        ticketNumber: "TK-2026-0001",
        clientId: clientIds[0],
        serviceId: serviceIds[0],
        subject: "No puedo acceder al panel Hestia",
        priority: "high",
        status: "in_progress",
        assignedTo: staffId,
        createdBy: staffId,
        messages: [
          {
            senderName: "Cliente 1",
            senderRole: "cliente",
            message: "Desde ayer no puedo conectarme al panel de Hestia. Me aparece error 403.",
            isInternal: false,
          },
          {
            senderName: "Admin",
            senderRole: "admin",
            message:
              "Revisando accesos. Parece que tu IP fue bloqueada temporalmente. Voy a desbloquearte.",
            isInternal: false,
          },
          {
            senderName: "Admin",
            senderRole: "admin",
            message:
              "Se requería resetear la contraseña tras 5 intentos fallidos. He resetado tu acceso.",
            isInternal: true,
          },
        ],
      },
      {
        id: generateSeedId(NS_SUPPORT, "tk-002"),
        ticketNumber: "TK-2026-0002",
        clientId: clientIds[1],
        serviceId: null,
        subject: "Consulta sobre facturación de servicio adicional",
        priority: "normal",
        status: "waiting_client",
        assignedTo: staffId,
        createdBy: staffId,
        messages: [
          {
            senderName: "Cliente 2",
            senderRole: "cliente",
            message:
              "¿Es posible agregar 10 casillas de correo más al servicio sin cambiar de plan?",
            isInternal: false,
          },
          {
            senderName: "Support",
            senderRole: "staff",
            message:
              "Sí, es posible agregar casillas por $200 mensuales adicionales. ¿Te interesa?",
            isInternal: false,
          },
        ],
      },
      {
        id: generateSeedId(NS_SUPPORT, "tk-003"),
        ticketNumber: "TK-2026-0003",
        clientId: clientIds[2],
        serviceId: serviceIds[2],
        subject: "Rendimiento lento del servidor",
        priority: "urgent",
        status: "open",
        assignedTo: null,
        createdBy: staffId,
        messages: [
          {
            senderName: "Cliente 3",
            senderRole: "cliente",
            message:
              "Mi sitio está muy lento. A veces tarda más de 10 segundos en cargar. Algo está mal.",
            isInternal: false,
          },
        ],
      },
      {
        id: generateSeedId(NS_SUPPORT, "tk-004"),
        ticketNumber: "TK-2026-0004",
        clientId: clientIds[3],
        serviceId: serviceIds[3],
        subject: "Solicitud de backup completo",
        priority: "normal",
        status: "resolved",
        assignedTo: staffId,
        resolvedAt: new Date("2026-06-10T14:30:00Z"),
        createdBy: staffId,
        messages: [
          {
            senderName: "Cliente 4",
            senderRole: "cliente",
            message: "Necesito un backup completo de mi sitio. Voy a hacer cambios importantes.",
            isInternal: false,
          },
          {
            senderName: "Admin",
            senderRole: "admin",
            message: "Listo, he generado un backup completo. Está disponible en tu panel.",
            isInternal: false,
          },
        ],
      },
      {
        id: generateSeedId(NS_SUPPORT, "tk-005"),
        ticketNumber: "TK-2026-0005",
        clientId: clientIds[0],
        serviceId: null,
        subject: "Error en pago con tarjeta",
        priority: "high",
        status: "closed",
        assignedTo: staffId,
        closedAt: new Date("2026-06-08T11:15:00Z"),
        createdBy: staffId,
        messages: [
          {
            senderName: "Cliente 1",
            senderRole: "cliente",
            message: "Mi pago fue rechazado pero igualmente se debitó de mi cuenta.",
            isInternal: false,
          },
          {
            senderName: "Billing Support",
            senderRole: "staff",
            message: "Verificamos y fue un rechazo momentáneo. Se revirtió automáticamente.",
            isInternal: false,
          },
          {
            senderName: "Billing Support",
            senderRole: "staff",
            message: "Problema resuelto. Se devolvió el débito.",
            isInternal: true,
          },
        ],
      },
    ];

    for (const ticket of tickets) {
      const { messages, ...ticketData } = ticket;

      // Insert ticket
      const ticketQuery = `
        INSERT INTO support_tickets
          (id, ticket_number, client_id, hosting_service_id, subject, priority, status, assigned_to, created_by, resolved_at, closed_at, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO NOTHING
      `;

      await client.query(ticketQuery, [
        ticketData.id,
        ticketData.ticketNumber,
        ticketData.clientId,
        ticketData.serviceId,
        ticketData.subject,
        ticketData.priority,
        ticketData.status,
        ticketData.assignedTo,
        ticketData.createdBy,
        ticketData.resolvedAt || null,
        ticketData.closedAt || null,
        new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      ]);

      // Insert messages
      if (messages && messages.length > 0) {
        for (const msg of messages) {
          const msgQuery = `
            INSERT INTO support_ticket_messages
              (id, ticket_id, sender_user_id, sender_name, sender_role, message, is_internal, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (id) DO NOTHING
          `;

          const msgId = generateSeedId(
            NS_SUPPORT,
            `${ticketData.id}-${msg.senderName}-${msg.message.substring(0, 20)}`,
          );
          await client.query(msgQuery, [
            msgId,
            ticketData.id,
            msg.senderRole === "admin" ? staffId : null,
            msg.senderName,
            msg.senderRole,
            msg.message,
            msg.isInternal || false,
            new Date(Date.now() - Math.random() * 6 * 24 * 60 * 60 * 1000),
          ]);
        }
      }

      console.log(`  ✓ ${ticketData.ticketNumber}: ${ticketData.subject}`);
    }

    console.log(`  ✓ Support Tickets: ${tickets.length} registros`);
  } finally {
    client.release();
  }
}
