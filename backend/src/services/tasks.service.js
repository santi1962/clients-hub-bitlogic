/**
 * Internal Tasks Service
 * Handles task CRUD, filtering, and status management.
 */
import { randomUUID } from "crypto";
import pool from "../db/pool.js";

function taskNotFound() {
  const e = new Error("Task not found");
  e.status = 404;
  return e;
}

const TASK_SELECT = `
  t.id, t.title, t.description, t.status, t.priority,
  t.assigned_to, t.created_by, t.client_id, t.hosting_service_id,
  t.domain_id, t.support_ticket_id, t.due_date, t.completed_at,
  t.created_at, t.updated_at,
  c.name as client_name, c.company as client_company,
  hs.domain as service_domain,
  d.domain as domain_name,
  st.ticket_number as ticket_number,
  u.name as assigned_user_name
`;

const TASK_JOINS = `
  FROM internal_tasks t
  LEFT JOIN clients c ON t.client_id = c.id
  LEFT JOIN hosting_services hs ON t.hosting_service_id = hs.id
  LEFT JOIN domains d ON t.domain_id = d.id
  LEFT JOIN support_tickets st ON t.support_ticket_id = st.id
  LEFT JOIN users u ON t.assigned_to = u.id
`;

export const tasksService = {
  /**
   * List tasks with filters
   */
  async listTasks({
    status,
    priority,
    assignedTo,
    clientId,
    serviceId,
    domainId,
    ticketId,
    search,
    dueBefore,
    page = 1,
    limit = 20,
  } = {}) {
    const conditions = [];
    const params = [];

    if (status) {
      conditions.push(`t.status = ?`);
      params.push(status);
    }
    if (priority) {
      conditions.push(`t.priority = ?`);
      params.push(priority);
    }
    if (assignedTo) {
      conditions.push(`t.assigned_to = ?`);
      params.push(assignedTo);
    }
    if (clientId) {
      conditions.push(`t.client_id = ?`);
      params.push(clientId);
    }
    if (serviceId) {
      conditions.push(`t.hosting_service_id = ?`);
      params.push(serviceId);
    }
    if (domainId) {
      conditions.push(`t.domain_id = ?`);
      params.push(domainId);
    }
    if (ticketId) {
      conditions.push(`t.support_ticket_id = ?`);
      params.push(ticketId);
    }
    if (search) {
      // LOWER()/LIKE en vez de ILIKE (no existe en MariaDB) — mismo criterio
      // que el resto de los dominios ya convertidos.
      conditions.push(`(LOWER(t.title) LIKE LOWER(?) OR LOWER(t.description) LIKE LOWER(?))`);
      params.push(`%${search}%`, `%${search}%`);
    }
    if (dueBefore) {
      conditions.push(`t.due_date <= ?`);
      params.push(dueBefore);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const offset = (page - 1) * limit;

    const [dataResult, countResult] = await Promise.all([
      pool.query(
        `SELECT ${TASK_SELECT} ${TASK_JOINS}
         ${where}
         ORDER BY (t.due_date IS NULL), t.due_date ASC, t.priority DESC, t.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      ),
      // AS count explícito: Postgres nombra "count" a SELECT COUNT(*) por
      // default, MariaDB la nombra "COUNT(*)" literal (mismo hallazgo que
      // en todos los dominios convertidos hasta ahora).
      pool.query(`SELECT COUNT(*) AS count FROM internal_tasks t ${where}`, params),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);

    return {
      data: dataResult.rows,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    };
  },

  /**
   * Get single task
   */
  async getTask(id) {
    const { rows } = await pool.query(
      `SELECT ${TASK_SELECT} ${TASK_JOINS} WHERE t.id = ?`,
      [id],
    );

    if (rows.length === 0) {
      throw taskNotFound();
    }

    return rows[0];
  },

  /**
   * Create task
   */
  async createTask({
    title,
    description,
    priority = "normal",
    assignedTo,
    createdBy,
    clientId,
    serviceId,
    domainId,
    ticketId,
    dueDate,
  }) {
    // id generado en la app (UUID v4, crypto.randomUUID) — misma política
    // que el resto de los dominios convertidos. INSERT sin RETURNING +
    // SELECT posterior por id.
    const id = randomUUID();
    await pool.query(
      `INSERT INTO internal_tasks
         (id, title, description, priority, assigned_to, created_by, client_id,
          hosting_service_id, domain_id, support_ticket_id, due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        title,
        description,
        priority,
        assignedTo || null,
        createdBy || null,
        clientId || null,
        serviceId || null,
        domainId || null,
        ticketId || null,
        dueDate || null,
      ],
    );
    const { rows } = await pool.query(`SELECT ${TASK_SELECT} ${TASK_JOINS} WHERE t.id = ?`, [id]);

    return rows[0];
  },

  /**
   * Update task
   */
  async updateTask(id, patch) {
    const allowed = ["title", "description", "status", "priority", "assigned_to", "due_date"];
    const updates = [];
    const values = [];

    Object.entries(patch).forEach(([key, value]) => {
      if (allowed.includes(key)) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (updates.length === 0) {
      return this.getTask(id);
    }

    // UPDATE...RETURNING -> UPDATE + SELECT posterior. El 404 se decide por
    // el SELECT, no por rowCount: un PATCH que reenvía el mismo valor que
    // ya tenía la fila (ej. la misma prioridad) da rowCount=0 en MariaDB
    // (sin CLIENT_FOUND_ROWS) aunque la tarea exista — mismo patrón que
    // clients/hosting/domains/support.
    values.push(id);
    await pool.query(`UPDATE internal_tasks SET ${updates.join(", ")} WHERE id = ?`, values);

    const { rows } = await pool.query(`SELECT id FROM internal_tasks WHERE id = ?`, [id]);
    if (rows.length === 0) throw taskNotFound();

    return this.getTask(id);
  },

  /**
   * Delete task (hard delete)
   */
  async deleteTask(id) {
    // Hard delete real: rowCount es seguro para un DELETE (sin ambigüedad
    // "matched pero sin cambio de valor"). Se guarda la fila completa ANTES
    // de borrarla para poder devolverla igual que hacía RETURNING * —
    // ningún otro dominio necesitó este paso porque sus DELETE no
    // devolvían la fila completa (solo id).
    const task = await this.getTask(id).catch(() => null);
    if (!task) throw taskNotFound();

    const { rowCount } = await pool.query(`DELETE FROM internal_tasks WHERE id = ?`, [id]);
    if (rowCount === 0) throw taskNotFound();

    return task;
  },

  /**
   * Complete task
   */
  async completeTask(id) {
    await pool.query(`UPDATE internal_tasks SET status = 'completed', completed_at = now() WHERE id = ?`, [id]);
    const { rows } = await pool.query(`SELECT id FROM internal_tasks WHERE id = ?`, [id]);
    if (rows.length === 0) throw taskNotFound();
    return this.getTask(id);
  },

  /**
   * Reopen task
   */
  async reopenTask(id) {
    await pool.query(`UPDATE internal_tasks SET status = 'pending', completed_at = null WHERE id = ?`, [id]);
    const { rows } = await pool.query(`SELECT id FROM internal_tasks WHERE id = ?`, [id]);
    if (rows.length === 0) throw taskNotFound();
    return this.getTask(id);
  },
};
