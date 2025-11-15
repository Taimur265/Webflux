/**
 * Executions API Routes
 */

import { Router } from 'express';
import { defaultStorage } from '@uwg/storage';

export const executionsRouter = Router();

/**
 * Get execution by ID
 */
executionsRouter.get('/:id', async (req, res, next) => {
  try {
    const execution = await defaultStorage.loadExecution(req.params.id);

    if (!execution) {
      return res.status(404).json({
        error: 'Execution not found',
      });
    }

    res.json({ execution });
  } catch (error) {
    next(error);
  }
});
