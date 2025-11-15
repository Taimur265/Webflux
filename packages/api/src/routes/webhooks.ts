/**
 * Webhooks API Routes
 */

import { Router } from 'express';
import { FlowExecutor } from '@uwg/engine';
import { defaultStorage } from '@uwg/storage';
import { connectorRegistry } from '@uwg/connectors';

export const webhooksRouter = Router();

/**
 * Trigger flow via webhook
 */
webhooksRouter.post('/:flow_id', async (req, res, next) => {
  try {
    const flow = await defaultStorage.loadFlow(req.params.flow_id);

    if (!flow) {
      return res.status(404).json({
        error: 'Flow not found',
      });
    }

    const executor = new FlowExecutor(connectorRegistry);

    const triggerData = {
      body: req.body,
      headers: req.headers,
      query: req.query,
    };

    // Execute in background
    executor.execute(flow, {}, triggerData).then(async (report) => {
      await defaultStorage.saveExecution(report);
    });

    res.status(202).json({
      message: 'Webhook received, flow execution started',
    });
  } catch (error) {
    next(error);
  }
});
