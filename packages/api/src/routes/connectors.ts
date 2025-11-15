/**
 * Connectors API Routes
 */

import { Router } from 'express';
import { connectorRegistry } from '@uwg/connectors';

export const connectorsRouter = Router();

/**
 * List all connectors
 */
connectorsRouter.get('/', async (req, res, next) => {
  try {
    const connectors = connectorRegistry.list();

    res.json({
      connectors,
      count: connectors.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get connector details
 */
connectorsRouter.get('/:name', async (req, res, next) => {
  try {
    const connector = connectorRegistry.get(req.params.name);

    if (!connector) {
      return res.status(404).json({
        error: 'Connector not found',
      });
    }

    res.json({
      connector: connector.definition,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get connector status
 */
connectorsRouter.get('/:name/status', async (req, res, next) => {
  try {
    const status = await connectorRegistry.status(req.params.name);

    res.json({ status });
  } catch (error) {
    next(error);
  }
});
