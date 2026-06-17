/**
 * Internal Tasks Seed (Phase 3C)
 * Creates sample internal tasks for testing
 */
import { v5 as uuidv5 } from "uuid";
import pool from "../db/pool.js";

const NS_TASKS = "f47ac10b-58cc-4372-a567-0e02b2c3d480";

function generateSeedId(namespace, name) {
  return uuidv5(name, namespace);
}

export async function run() {
  const client = await pool.connect();
  try {
    console.log("  Seeding internal tasks…");

    const adminId = "11111111-1111-1111-1111-111111111111";
    const clientIds = [
      "22222222-2222-2222-2222-000000000001",
      "22222222-2222-2222-2222-000000000002",
      "22222222-2222-2222-2222-000000000003",
    ];
    const serviceIds = [
      "33333333-3333-3333-3333-000000000001",
      "33333333-3333-3333-3333-000000000002",
    ];
    const domainIds = [generateSeedId(NS_TASKS, "domain-1"), generateSeedId(NS_TASKS, "domain-2")];
    const ticketIds = [generateSeedId(NS_TASKS, "tk-1"), generateSeedId(NS_TASKS, "tk-2")];

    const tasks = [
      {
        id: generateSeedId(NS_TASKS, "task-001"),
        title: "Migrar servicio empresa1 a nuevo servidor",
        description: "Realizar migración de hosting para cliente 1",
        status: "in_progress",
        priority: "high",
        assignedTo: adminId,
        createdBy: adminId,
        clientId: clientIds[0],
        serviceId: serviceIds[0],
        dueDate: "2026-06-25",
      },
      {
        id: generateSeedId(NS_TASKS, "task-002"),
        title: "Renovar dominio empresa1.com.ar",
        description: "Gestionar renovación anual del dominio",
        status: "pending",
        priority: "normal",
        assignedTo: null,
        createdBy: adminId,
        clientId: clientIds[0],
        domainId: null,
        dueDate: "2026-07-10",
      },
      {
        id: generateSeedId(NS_TASKS, "task-003"),
        title: "Investigar rendimiento lento",
        description: "Cliente reporta sitio muy lento, revisar logs y optimizar",
        status: "pending",
        priority: "urgent",
        assignedTo: adminId,
        createdBy: adminId,
        clientId: clientIds[1],
        serviceId: serviceIds[1],
        ticketId: null,
        dueDate: "2026-06-18",
      },
      {
        id: generateSeedId(NS_TASKS, "task-004"),
        title: "Actualizar certificado SSL",
        description: "Renovar certificado SSL para servicio 2",
        status: "completed",
        priority: "high",
        assignedTo: adminId,
        createdBy: adminId,
        clientId: clientIds[1],
        serviceId: serviceIds[1],
        completedAt: new Date("2026-06-10T14:30:00Z"),
        dueDate: "2026-06-15",
      },
      {
        id: generateSeedId(NS_TASKS, "task-005"),
        title: "Contactar cliente para renovación de plan",
        description: "Cliente 3 vence servicio próximamente, ofrecerle upgrade",
        status: "pending",
        priority: "normal",
        assignedTo: null,
        createdBy: adminId,
        clientId: clientIds[2],
        dueDate: "2026-06-20",
      },
      {
        id: generateSeedId(NS_TASKS, "task-006"),
        title: "Backup completo sistema",
        description: "Realizar backup de todos los servicios activos",
        status: "pending",
        priority: "normal",
        assignedTo: adminId,
        createdBy: adminId,
        dueDate: "2026-06-17",
      },
      {
        id: generateSeedId(NS_TASKS, "task-007"),
        title: "Revisar ticket soporte #TK-2026-0001",
        description: "Cliente reporta acceso al panel, verificar credenciales",
        status: "in_progress",
        priority: "high",
        assignedTo: adminId,
        createdBy: adminId,
        ticketId: null,
        dueDate: "2026-06-16",
      },
      {
        id: generateSeedId(NS_TASKS, "task-008"),
        title: "Configurar redirect dominio antiguo",
        description: "Cliente cambió de dominio, configurar redirección 301",
        status: "pending",
        priority: "normal",
        assignedTo: null,
        createdBy: adminId,
        domainId: null,
        dueDate: "2026-06-22",
      },
      {
        id: generateSeedId(NS_TASKS, "task-009"),
        title: "Revisar cuota de almacenamiento",
        description: "Cliente 1 está usando 85% de almacenamiento, notificar",
        status: "completed",
        priority: "low",
        assignedTo: adminId,
        createdBy: adminId,
        clientId: clientIds[0],
        serviceId: serviceIds[0],
        completedAt: new Date("2026-06-12T10:00:00Z"),
        dueDate: "2026-06-12",
      },
      {
        id: generateSeedId(NS_TASKS, "task-010"),
        title: "Crear entrada en DNS para email",
        description: "Configurar registros SPF, DKIM, DMARC",
        status: "pending",
        priority: "high",
        assignedTo: null,
        createdBy: adminId,
        clientId: clientIds[1],
        serviceId: serviceIds[1],
        dueDate: "2026-06-21",
      },
      {
        id: generateSeedId(NS_TASKS, "task-011"),
        title: "Audit de seguridad mensual",
        description: "Revisar logs de acceso y anomalías de seguridad",
        status: "pending",
        priority: "normal",
        assignedTo: adminId,
        createdBy: adminId,
        dueDate: "2026-06-30",
      },
      {
        id: generateSeedId(NS_TASKS, "task-012"),
        title: "Documentar cambios en servicio 1",
        description: "Actualizar documentación interna tras migración",
        status: "cancelled",
        priority: "low",
        assignedTo: null,
        createdBy: adminId,
        clientId: clientIds[0],
        serviceId: serviceIds[0],
        dueDate: "2026-06-28",
      },
    ];

    for (const t of tasks) {
      const { completedAt, ...taskData } = t;

      await client.query(
        `INSERT INTO internal_tasks
          (id, title, description, status, priority, assigned_to, created_by,
           client_id, hosting_service_id, domain_id, support_ticket_id, due_date, completed_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (id) DO NOTHING`,
        [
          taskData.id,
          taskData.title,
          taskData.description,
          taskData.status,
          taskData.priority,
          taskData.assignedTo,
          taskData.createdBy,
          taskData.clientId,
          taskData.serviceId,
          taskData.domainId,
          taskData.ticketId,
          taskData.dueDate,
          completedAt || null,
          new Date(Date.now() - Math.random() * 10 * 24 * 60 * 60 * 1000),
        ],
      );

      console.log(`  ✓ ${taskData.title.substring(0, 40)}`);
    }

    console.log(`  ✓ Internal Tasks: ${tasks.length} tareas`);
  } finally {
    client.release();
  }
}
