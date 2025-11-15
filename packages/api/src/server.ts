/**
 * UWG API Server
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

import { flowsRouter } from './routes/flows';
import { executionsRouter } from './routes/executions';
import { connectorsRouter } from './routes/connectors';
import { webhooksRouter } from './routes/webhooks';
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/logger';
import { metricsMiddleware, metricsHandler, healthCheckHandler } from './middleware/metrics';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const METRICS_ENABLED = process.env.METRICS_ENABLED !== 'false';
const DISTRIBUTED_RATE_LIMIT_ENABLED = process.env.REDIS_HOST && process.env.DISTRIBUTED_RATE_LIMIT !== 'false';

// Security middleware
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
}));

// Metrics middleware (if enabled)
if (METRICS_ENABLED) {
  app.use(metricsMiddleware());
}

// Rate limiting (distributed if Redis available, otherwise in-memory)
if (DISTRIBUTED_RATE_LIMIT_ENABLED) {
  const { createDefaultRateLimiters } = require('./middleware/distributed-rate-limiter');
  const rateLimiters = createDefaultRateLimiters({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  });

  app.use('/api/', rateLimiters.api);
  console.log('✅ Distributed rate limiting enabled (Redis)');
} else {
  // Fallback to in-memory rate limiting
  const rateLimit = require('express-rate-limit');
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.',
  });
  app.use('/api/', limiter);
  console.log('⚠️  Using in-memory rate limiting (Redis not configured)');
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// Health check
app.get('/health', healthCheckHandler);

// Metrics endpoint (Prometheus)
if (METRICS_ENABLED) {
  app.get('/metrics', metricsHandler);
}

// API routes
app.use('/api/flows', flowsRouter);
app.use('/api/executions', executionsRouter);
app.use('/api/connectors', connectorsRouter);
app.use('/api/webhooks', webhooksRouter);

// API documentation
app.get('/api', (req, res) => {
  res.json({
    name: 'UWG Engine API',
    version: '0.1.0',
    endpoints: {
      flows: {
        'GET /api/flows': 'List all flows',
        'POST /api/flows': 'Create a new flow',
        'GET /api/flows/:id': 'Get a flow by ID',
        'PUT /api/flows/:id': 'Update a flow',
        'DELETE /api/flows/:id': 'Delete a flow',
        'POST /api/flows/:id/execute': 'Execute a flow',
      },
      executions: {
        'GET /api/executions': 'List all executions',
        'GET /api/executions/:id': 'Get execution details',
        'GET /api/flows/:id/executions': 'List executions for a flow',
      },
      connectors: {
        'GET /api/connectors': 'List available connectors',
        'GET /api/connectors/:name': 'Get connector details',
        'GET /api/connectors/:name/status': 'Get connector auth status',
      },
      webhooks: {
        'POST /api/webhooks/:flow_id': 'Trigger flow via webhook',
      },
    },
  });
});

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 UWG API Server running on port ${PORT}`);
  console.log(`📚 API documentation: http://localhost:${PORT}/api`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
});

export default app;
