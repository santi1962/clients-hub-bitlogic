/**
 * Internal Tasks Controller
 */
import { tasksService } from "../services/tasks.service.js";
import { auditService } from "../services/audit.service.js";

export async function listTasks(req, res, next) {
  try {
    const {
      status,
      priority,
      assignedTo,
      clientId,
      serviceId,
      domainId,
      ticketId,
      search,
      dueBefore,
      page,
      limit,
    } = req.query;

    const result = await tasksService.listTasks({
      status,
      priority,
      assignedTo,
      clientId,
      serviceId,
      domainId,
      ticketId,
      search,
      dueBefore,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getTask(req, res, next) {
  try {
    const { id } = req.params;
    const task = await tasksService.getTask(id);
    res.json(task);
  } catch (err) {
    next(err);
  }
}

export async function createTask(req, res, next) {
  try {
    const {
      title,
      description,
      priority,
      assignedTo,
      clientId,
      serviceId,
      domainId,
      ticketId,
      dueDate,
    } = req.body;
    const createdBy = req.user?.id;

    if (!title) {
      return res.status(400).json({ error: { message: "title required" } });
    }

    const task = await tasksService.createTask({
      title,
      description,
      priority,
      assignedTo,
      createdBy,
      clientId,
      serviceId,
      domainId,
      ticketId,
      dueDate,
    });

    await auditService.logAction({
      user: req.user,
      action: "crear",
      entityType: "tarea",
      entityId: task.id,
      entityName: task.title,
      newValues: { title, priority },
    });

    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
}

export async function updateTask(req, res, next) {
  try {
    const { id } = req.params;
    const oldTask = await tasksService.getTask(id);
    const task = await tasksService.updateTask(id, req.body);
    await auditService.logAction({
      user: req.user,
      action: "editar",
      entityType: "tarea",
      entityId: id,
      entityName: task.title,
      oldValues: oldTask,
      newValues: req.body,
    });
    res.json(task);
  } catch (err) {
    next(err);
  }
}

export async function deleteTask(req, res, next) {
  try {
    const { id } = req.params;
    const oldTask = await tasksService.getTask(id);
    const task = await tasksService.deleteTask(id);
    await auditService.logAction({
      user: req.user,
      action: "cancelar",
      entityType: "tarea",
      entityId: id,
      entityName: oldTask.title,
      oldValues: { status: oldTask.status },
      newValues: { status: "cancelled" },
    });
    res.json(task);
  } catch (err) {
    next(err);
  }
}

export async function completeTask(req, res, next) {
  try {
    const { id } = req.params;
    const oldTask = await tasksService.getTask(id);
    const task = await tasksService.completeTask(id);
    await auditService.logAction({
      user: req.user,
      action: "completar",
      entityType: "tarea",
      entityId: id,
      entityName: oldTask.title,
      oldValues: { status: oldTask.status },
      newValues: { status: "completed" },
    });
    res.json(task);
  } catch (err) {
    next(err);
  }
}

export async function reopenTask(req, res, next) {
  try {
    const { id } = req.params;
    const oldTask = await tasksService.getTask(id);
    const task = await tasksService.reopenTask(id);
    await auditService.logAction({
      user: req.user,
      action: "reabrir",
      entityType: "tarea",
      entityId: id,
      entityName: oldTask.title,
      oldValues: { status: oldTask.status },
      newValues: { status: "pending" },
    });
    res.json(task);
  } catch (err) {
    next(err);
  }
}
