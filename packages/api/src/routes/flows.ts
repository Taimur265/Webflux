/**
 * Flows API Routes
 */

import { Router } from 'express';
import { validateFlowComprehensive } from '@uwg/schema';
import { FlowExecutor } from '@uwg/engine';
import { defaultStorage } from '@uwg/storage';
import { connectorRegistry } from '@uwg/connectors';
import { dslToFlow } from '@uwg/dsl';

export const flowsRouter = Router();

/**
 * List all flows
 */
flowsRouter.get('/', async (req, res, next) => {
  try {
    const { owner, tags, limit, offset } = req.query;

    const flows = await defaultStorage.listFlows({
      owner: owner as string | undefined,
      tags: tags ? (tags as string).split(',') : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json({
      flows,
      count: flows.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Create a new flow
 */
flowsRouter.post('/', async (req, res, next) => {
  try {
    const { flow, dsl } = req.body;

    let flowData;

    if (dsl) {
      // Parse DSL
      flowData = dslToFlow(dsl, req.body.owner || 'api-user');
    } else if (flow) {
      flowData = flow;
    } else {
      return res.status(400).json({
        error: 'Either "flow" (JSON) or "dsl" (string) must be provided',
      });
    }

    // Validate
    const validation = validateFlowComprehensive(flowData);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Flow validation failed',
        details: validation.errors,
      });
    }

    // Save
    const flowId = await defaultStorage.saveFlow(flowData);

    res.status(201).json({
      flow_id: flowId,
      message: 'Flow created successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get a flow by ID
 */
flowsRouter.get('/:id', async (req, res, next) => {
  try {
    const flow = await defaultStorage.loadFlow(req.params.id);

    if (!flow) {
      return res.status(404).json({
        error: 'Flow not found',
      });
    }

    res.json({ flow });
  } catch (error) {
    next(error);
  }
});

/**
 * Update a flow
 */
flowsRouter.put('/:id', async (req, res, next) => {
  try {
    const { flow } = req.body;

    // Ensure flow_id matches
    flow.flow_id = req.params.id;

    // Validate
    const validation = validateFlowComprehensive(flow);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Flow validation failed',
        details: validation.errors,
      });
    }

    // Save (will update existing)
    await defaultStorage.saveFlow(flow);

    res.json({
      message: 'Flow updated successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Delete a flow
 */
flowsRouter.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await defaultStorage.deleteFlow(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        error: 'Flow not found',
      });
    }

    res.json({
      message: 'Flow deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Execute a flow
 */
flowsRouter.post('/:id/execute', async (req, res, next) => {
  try {
    const flow = await defaultStorage.loadFlow(req.params.id);

    if (!flow) {
      return res.status(404).json({
        error: 'Flow not found',
      });
    }

    const executor = new FlowExecutor(connectorRegistry);
    const triggerData = req.body.trigger_data || {};

    // Execute in background
    executor.execute(flow, {}, triggerData).then(async (report) => {
      // Save execution report
      await defaultStorage.saveExecution(report);
    });

    res.status(202).json({
      message: 'Flow execution started',
      note: 'Check execution status via /api/executions/:run_id',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get flow execution history
 */
flowsRouter.get('/:id/executions', async (req, res, next) => {
  try {
    const { limit, offset } = req.query;

    const executions = await defaultStorage.listExecutions(req.params.id, {
      limit: limit ? parseInt(limit as string) : 20,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json({
      executions,
      count: executions.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get flow version history
 */
flowsRouter.get('/:id/history', async (req, res, next) => {
  try {
    const history = await defaultStorage.getFlowHistory(req.params.id);

    res.json({
      history,
      count: history.length,
    });
  } catch (error) {
    next(error);
  }
});
