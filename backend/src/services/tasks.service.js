/**
 * Internal Tasks Service
 * Handles task CRUD, filtering, and status management.
 */
import pool from "../db/pool.js";

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
    let query = `
      SELECT
        t.id, t.title, t.description, t.status, t.priority,
        t.assigned_to, t.created_by, t.client_id, t.hosting_service_id,
        t.domain_id, t.support_ticket_id, t.due_date, t.completed_at,
        t.created_at, t.updated_at,
        c.name as client_name, c.company as client_company,
        hs.domain as service_domain,
        d.domain as domain_name,
        st.ticket_number as ticket_number,
        u.name as assigned_user_name
      FROM internal_tasks t
      LEFT JOIN clients c ON t.client_id = c.id
      LEFT JOIN hosting_services hs ON t.hosting_service_id = hs.id
      LEFT JOIN domains d ON t.domain_id = d.id
      LEFT JOIN support_tickets st ON t.support_ticket_id = st.id
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ` AND t.status = $${params.length + 1}`;
      params.push(status);
    }

    if (priority) {
      query += ` AND t.priority = $${params.length + 1}`;
      params.push(priority);
    }

    if (assignedTo) {
      query += ` AND t.assigned_to = $${params.length + 1}`;
      params.push(assignedTo);
    }

    if (clientId) {
      query += ` AND t.client_id = $${params.length + 1}`;
      params.push(clientId);
    }

    if (serviceId) {
      query += ` AND t.hosting_service_id = $${params.length + 1}`;
      params.push(serviceId);
    }

    if (domainId) {
      query += ` AND t.domain_id = $${params.length + 1}`;
      params.push(domainId);
    }

    if (ticketId) {
      query += ` AND t.support_ticket_id = $${params.length + 1}`;
      params.push(ticketId);
    }

    if (search) {
      query += ` AND (t.title ILIKE $${params.length + 1} OR t.description ILIKE $${params.length + 1})`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (dueBefore) {
      query += ` AND t.due_date <= $${params.length + 1}`;
      params.push(dueBefore);
    }

    const offset = (page - 1) * limit;
    query += ` ORDER BY t.due_date ASC NULLS LAST, t.priority DESC, t.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Count total
    let countQuery = `SELECT COUNT(*) FROM internal_tasks t WHERE 1=1`;
    const countParams = [];
    let paramIndex = 1;

    if (status) {
      countQuery += ` AND t.status = $${paramIndex++}`;
      countParams.push(status);
    }
    if (priority) {
      countQuery += ` AND t.priority = $${paramIndex++}`;
      countParams.push(priority);
    }
    if (assignedTo) {
      countQuery += ` AND t.assigned_to = $${paramIndex++}`;
      countParams.push(assignedTo);
    }
    if (clientId) {
      countQuery += ` AND t.client_id = $${paramIndex++}`;
      countParams.push(clientId);
    }
    if (serviceId) {
      countQuery += ` AND t.hosting_service_id = $${paramIndex++}`;
      countParams.push(serviceId);
    }
    if (domainId) {
      countQuery += ` AND t.domain_id = $${paramIndex++}`;
      countParams.push(domainId);
    }
    if (ticketId) {
      countQuery += ` AND t.support_ticket_id = $${paramIndex++}`;
      countParams.push(ticketId);
    }
    if (search) {
      countQuery += ` AND (t.title ILIKE $${paramIndex++} OR t.description ILIKE $${paramIndex++})`;
      const searchTerm = `%${search}%`;
      countParams.push(searchTerm, searchTerm);
    }
    if (dueBefore) {
      countQuery += ` AND t.due_date <= $${paramIndex++}`;
      countParams.push(dueBefore);
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count, 10);

    return {
      data: result.rows,
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
    const query = `
      SELECT
        t.id, t.title, t.description, t.status, t.priority,
        t.assigned_to, t.created_by, t.client_id, t.hosting_service_id,
        t.domain_id, t.support_ticket_id, t.due_date, t.completed_at,
        t.created_at, t.updated_at,
        c.name as client_name, c.company as client_company,
        hs.domain as service_domain,
        d.domain as domain_name,
        st.ticket_number as ticket_number,
        u.name as assigned_user_name
      FROM internal_tasks t
      LEFT JOIN clients c ON t.client_id = c.id
      LEFT JOIN hosting_services hs ON t.hosting_service_id = hs.id
      LEFT JOIN domains d ON t.domain_id = d.id
      LEFT JOIN support_tickets st ON t.support_ticket_id = st.id
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.id = $1
    `;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      throw new Error("Task not found");
    }

    return result.rows[0];
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
    const query = `
      INSERT INTO internal_tasks
        (title, description, priority, assigned_to, created_by, client_id,
         hosting_service_id, domain_id, support_ticket_id, due_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const result = await pool.query(query, [
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
    ]);

    return result.rows[0];
  },

  /**
   * Update task
   */
  async updateTask(id, patch) {
    const allowed = ["title", "description", "status", "priority", "assigned_to", "due_date"];
    const updates = [];
    const values = [];
    let paramIndex = 1;

    Object.entries(patch).forEach(([key, value]) => {
      if (allowed.includes(key)) {
        updates.push(`${key} = $${paramIndex++}`);
        values.push(value);
      }
    });

    if (updates.length === 0) {
      return this.getTask(id);
    }

    values.push(id);
    const query = `
      UPDATE internal_tasks
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    if (result.rows.length === 0) throw new Error("Task not found");

    return result.rows[0];
  },

  /**
   * Delete task (soft delete: set status to cancelled)
   */
  async deleteTask(id) {
    const query = `
      UPDATE internal_tasks
      SET status = 'cancelled'
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) throw new Error("Task not found");
    return result.rows[0];
  },

  /**
   * Complete task
   */
  async completeTask(id) {
    const query = `
      UPDATE internal_tasks
      SET status = 'completed', completed_at = now()
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) throw new Error("Task not found");
    return result.rows[0];
  },

  /**
   * Reopen task
   */
  async reopenTask(id) {
    const query = `
      UPDATE internal_tasks
      SET status = 'pending', completed_at = null
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) throw new Error("Task not found");
    return result.rows[0];
  },
};
