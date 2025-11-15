/**
 * Multi-Tenancy & RBAC (Role-Based Access Control)
 * Enterprise-grade tenant isolation and permissions
 */

import type { Flow } from '@uwg/schema';
import { RedisCache } from '../../storage/src/redis-cache';

export type Role = 'owner' | 'admin' | 'editor' | 'viewer' | 'executor';
export type Permission =
  | 'flow:create'
  | 'flow:read'
  | 'flow:update'
  | 'flow:delete'
  | 'flow:execute'
  | 'flow:share'
  | 'user:invite'
  | 'user:remove'
  | 'billing:view'
  | 'billing:manage'
  | 'audit:view';

export interface Tenant {
  tenantId: string;
  name: string;
  plan: 'free' | 'pro' | 'enterprise';
  limits: {
    maxFlows: number;
    maxUsers: number;
    maxExecutions: number; // per month
    maxConnectors: number;
  };
  settings: {
    allowExternalSharing: boolean;
    requireMFA: boolean;
    auditLogRetention: number; // days
    customDomain?: string;
  };
  createdAt: string;
  status: 'active' | 'suspended' | 'trial';
}

export interface User {
  userId: string;
  email: string;
  name: string;
  tenantId: string;
  roles: Role[];
  permissions: Permission[];
  customPermissions?: Permission[];
  mfaEnabled: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface TenantInvitation {
  invitationId: string;
  tenantId: string;
  email: string;
  role: Role;
  invitedBy: string;
  expiresAt: string;
  status: 'pending' | 'accepted' | 'expired';
}

export interface AuditLog {
  logId: string;
  tenantId: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  details: any;
  ip: string;
  userAgent: string;
  timestamp: string;
}

/**
 * Role to Permissions mapping
 */
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: [
    'flow:create',
    'flow:read',
    'flow:update',
    'flow:delete',
    'flow:execute',
    'flow:share',
    'user:invite',
    'user:remove',
    'billing:view',
    'billing:manage',
    'audit:view',
  ],
  admin: [
    'flow:create',
    'flow:read',
    'flow:update',
    'flow:delete',
    'flow:execute',
    'flow:share',
    'user:invite',
    'user:remove',
    'audit:view',
  ],
  editor: [
    'flow:create',
    'flow:read',
    'flow:update',
    'flow:execute',
    'flow:share',
  ],
  viewer: ['flow:read'],
  executor: ['flow:read', 'flow:execute'],
};

/**
 * Plan Limits
 */
const PLAN_LIMITS: Record<Tenant['plan'], Tenant['limits']> = {
  free: {
    maxFlows: 10,
    maxUsers: 3,
    maxExecutions: 1000,
    maxConnectors: 5,
  },
  pro: {
    maxFlows: 100,
    maxUsers: 10,
    maxExecutions: 50000,
    maxConnectors: 20,
  },
  enterprise: {
    maxFlows: -1, // Unlimited
    maxUsers: -1,
    maxExecutions: -1,
    maxConnectors: -1,
  },
};

export class MultiTenancyManager {
  private cache: RedisCache;

  constructor(cache?: RedisCache) {
    this.cache = cache || new RedisCache({
      keyPrefix: 'uwg:tenants:',
    });
  }

  async initialize(): Promise<void> {
    await this.cache.connect();
    console.log('🏢 Multi-tenancy initialized');
  }

  /**
   * Create a new tenant
   */
  async createTenant(
    name: string,
    plan: Tenant['plan'] = 'free',
    ownerId: string
  ): Promise<Tenant> {
    const tenantId = `tenant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const tenant: Tenant = {
      tenantId,
      name,
      plan,
      limits: PLAN_LIMITS[plan],
      settings: {
        allowExternalSharing: plan !== 'free',
        requireMFA: plan === 'enterprise',
        auditLogRetention: plan === 'enterprise' ? 90 : plan === 'pro' ? 30 : 7,
      },
      createdAt: new Date().toISOString(),
      status: plan === 'free' ? 'active' : 'trial',
    };

    await this.cache.set(tenantId, tenant);

    console.log(`🏢 Tenant created: ${tenantId} (${plan})`);

    return tenant;
  }

  /**
   * Get tenant by ID
   */
  async getTenant(tenantId: string): Promise<Tenant | null> {
    return await this.cache.get(tenantId);
  }

  /**
   * Update tenant
   */
  async updateTenant(tenantId: string, updates: Partial<Tenant>): Promise<Tenant> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    const updated = { ...tenant, ...updates };
    await this.cache.set(tenantId, updated);

    return updated;
  }

  /**
   * Check tenant limits
   */
  async checkLimits(
    tenantId: string,
    resource: keyof Tenant['limits']
  ): Promise<{ allowed: boolean; current: number; limit: number }> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    const limit = tenant.limits[resource];

    // -1 means unlimited
    if (limit === -1) {
      return { allowed: true, current: 0, limit: -1 };
    }

    // Get current usage
    const current = await this.getCurrentUsage(tenantId, resource);

    return {
      allowed: current < limit,
      current,
      limit,
    };
  }

  /**
   * Get current usage for a resource
   */
  private async getCurrentUsage(
    tenantId: string,
    resource: keyof Tenant['limits']
  ): Promise<number> {
    switch (resource) {
      case 'maxFlows':
        return await this.cache.lLen(`flows:${tenantId}`);

      case 'maxUsers':
        return await this.cache.lLen(`users:${tenantId}`);

      case 'maxExecutions':
        const execCount = await this.cache.get(`executions:${tenantId}:count`);
        return execCount || 0;

      default:
        return 0;
    }
  }

  /**
   * Create user within tenant
   */
  async createUser(
    tenantId: string,
    email: string,
    name: string,
    roles: Role[] = ['viewer']
  ): Promise<User> {
    // Check user limit
    const limits = await this.checkLimits(tenantId, 'maxUsers');
    if (!limits.allowed) {
      throw new Error(`User limit reached: ${limits.limit}`);
    }

    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const permissions = this.getPermissionsForRoles(roles);

    const user: User = {
      userId,
      email,
      name,
      tenantId,
      roles,
      permissions,
      mfaEnabled: false,
      createdAt: new Date().toISOString(),
    };

    await this.cache.hSet(`users:${tenantId}`, userId, user);
    await this.cache.rPush(`users:${tenantId}`, userId);

    console.log(`👤 User created: ${userId} in tenant ${tenantId}`);

    return user;
  }

  /**
   * Get permissions for roles
   */
  private getPermissionsForRoles(roles: Role[]): Permission[] {
    const permissions = new Set<Permission>();

    for (const role of roles) {
      const rolePerms = ROLE_PERMISSIONS[role];
      rolePerms.forEach(p => permissions.add(p));
    }

    return Array.from(permissions);
  }

  /**
   * Get user by ID
   */
  async getUser(tenantId: string, userId: string): Promise<User | null> {
    return await this.cache.hGet(`users:${tenantId}`, userId);
  }

  /**
   * Check if user has permission
   */
  async hasPermission(
    tenantId: string,
    userId: string,
    permission: Permission
  ): Promise<boolean> {
    const user = await this.getUser(tenantId, userId);
    if (!user) return false;

    return (
      user.permissions.includes(permission) ||
      (user.customPermissions || []).includes(permission)
    );
  }

  /**
   * Grant custom permission to user
   */
  async grantPermission(
    tenantId: string,
    userId: string,
    permission: Permission
  ): Promise<void> {
    const user = await this.getUser(tenantId, userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    if (!user.customPermissions) {
      user.customPermissions = [];
    }

    if (!user.customPermissions.includes(permission)) {
      user.customPermissions.push(permission);
      await this.cache.hSet(`users:${tenantId}`, userId, user);
      console.log(`✅ Granted ${permission} to user ${userId}`);
    }
  }

  /**
   * Revoke custom permission from user
   */
  async revokePermission(
    tenantId: string,
    userId: string,
    permission: Permission
  ): Promise<void> {
    const user = await this.getUser(tenantId, userId);
    if (!user) return;

    if (user.customPermissions) {
      user.customPermissions = user.customPermissions.filter(p => p !== permission);
      await this.cache.hSet(`users:${tenantId}`, userId, user);
      console.log(`❌ Revoked ${permission} from user ${userId}`);
    }
  }

  /**
   * Create invitation
   */
  async createInvitation(
    tenantId: string,
    email: string,
    role: Role,
    invitedBy: string
  ): Promise<TenantInvitation> {
    const invitationId = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const invitation: TenantInvitation = {
      invitationId,
      tenantId,
      email,
      role,
      invitedBy,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      status: 'pending',
    };

    await this.cache.hSet(`invitations:${tenantId}`, invitationId, invitation);

    console.log(`📧 Invitation created: ${email} to tenant ${tenantId}`);

    return invitation;
  }

  /**
   * Accept invitation
   */
  async acceptInvitation(invitationId: string): Promise<User> {
    // Find invitation
    const keys = await this.cache.keys('invitations:*');

    for (const key of keys) {
      const invitation = await this.cache.hGet<TenantInvitation>(key, invitationId);

      if (invitation) {
        // Check expiration
        if (new Date(invitation.expiresAt) < new Date()) {
          invitation.status = 'expired';
          await this.cache.hSet(key, invitationId, invitation);
          throw new Error('Invitation has expired');
        }

        // Create user
        const user = await this.createUser(
          invitation.tenantId,
          invitation.email,
          invitation.email.split('@')[0],
          [invitation.role]
        );

        // Mark invitation as accepted
        invitation.status = 'accepted';
        await this.cache.hSet(key, invitationId, invitation);

        return user;
      }
    }

    throw new Error('Invitation not found');
  }

  /**
   * Log audit event
   */
  async logAudit(log: Omit<AuditLog, 'logId' | 'timestamp'>): Promise<void> {
    const auditLog: AuditLog = {
      logId: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...log,
      timestamp: new Date().toISOString(),
    };

    await this.cache.rPush(`audit:${log.tenantId}`, auditLog);

    console.log(`📝 Audit log: ${log.action} on ${log.resource} by ${log.userId}`);
  }

  /**
   * Get audit logs
   */
  async getAuditLogs(
    tenantId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<AuditLog[]> {
    return await this.cache.lRange(`audit:${tenantId}`, offset, offset + limit - 1);
  }

  /**
   * Isolate flow data by tenant
   */
  getTenantFlowKey(tenantId: string): string {
    return `flows:${tenantId}`;
  }

  /**
   * Validate tenant access to resource
   */
  async validateTenantAccess(
    tenantId: string,
    resourceId: string,
    resourceType: string
  ): Promise<boolean> {
    // Check if resource belongs to tenant
    const key = `${resourceType}:${tenantId}`;
    const resources = await this.cache.lRange(key, 0, -1);

    return resources.includes(resourceId);
  }

  /**
   * Get tenant usage statistics
   */
  async getUsageStats(tenantId: string): Promise<{
    flows: { current: number; limit: number };
    users: { current: number; limit: number };
    executions: { current: number; limit: number };
  }> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    return {
      flows: {
        current: await this.getCurrentUsage(tenantId, 'maxFlows'),
        limit: tenant.limits.maxFlows,
      },
      users: {
        current: await this.getCurrentUsage(tenantId, 'maxUsers'),
        limit: tenant.limits.maxUsers,
      },
      executions: {
        current: await this.getCurrentUsage(tenantId, 'maxExecutions'),
        limit: tenant.limits.maxExecutions,
      },
    };
  }
}

// Singleton instance
export const multiTenancy = new MultiTenancyManager();
