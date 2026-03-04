/**
 * Base Repository with Soft-Delete Support
 * 
 * Provides common CRUD operations with automatic soft-delete handling
 * and optimistic locking for all entities.
 */

import { PrismaClient } from '@prisma/client';

/**
 * Base entity fields for soft-delete and versioning
 */
export interface SoftDeleteEntity {
  deletedAt: Date | null;
  version: number;
}

/**
 * Options for find operations
 */
export interface FindOptions {
  /** Include soft-deleted records */
  includeDeleted?: boolean;
}

/**
 * Options for update operations with optimistic locking
 */
export interface UpdateOptions<T extends SoftDeleteEntity> {
  /** Expected version for optimistic locking */
  expectedVersion?: number;
  /** User ID performing the update */
  updatedById?: string;
}

/**
 * Error thrown when optimistic locking fails
 */
export class OptimisticLockError extends Error {
  constructor(
    public entityId: string,
    public expectedVersion: number,
    public actualVersion: number,
  ) {
    super(
      `Optimistic lock failed for entity ${entityId}. ` +
      `Expected version ${expectedVersion}, but found ${actualVersion}.`,
    );
    this.name = 'OptimisticLockError';
  }
}

/**
 * Error thrown when trying to access a soft-deleted entity
 */
export class SoftDeletedError extends Error {
  constructor(public entityId: string) {
    super(`Entity ${entityId} has been soft-deleted`);
    this.name = 'SoftDeletedError';
  }
}

/**
 * Base repository providing common CRUD operations with soft-delete support
 */
export abstract class BaseRepository<
  T extends SoftDeleteEntity & { id: string },
  CreateInput extends object,
  UpdateInput extends object,
> {
  protected constructor(
    protected prisma: PrismaClient,
    protected model: any, // Prisma model delegate
  ) {}

  /**
   * Get the where clause for soft-delete filtering
   */
  protected getWhereClause(options?: FindOptions): Record<string, unknown> {
    if (options?.includeDeleted) {
      return {};
    }
    return { deletedAt: null };
  }

  /**
   * Find a single entity by unique identifier
   */
  async findUnique(
    where: { id: string },
    options?: FindOptions,
  ): Promise<T | null> {
    return this.model.findUnique({
      where: {
        ...where,
        ...this.getWhereClause(options),
      },
    });
  }

  /**
   * Find a single entity or throw
   */
  async findUniqueOrThrow(
    where: { id: string },
    options?: FindOptions,
  ): Promise<T> {
    const entity = await this.findUnique(where, options);
    if (!entity) {
      throw new Error(`Entity not found: ${where.id}`);
    }
    return entity;
  }

  /**
   * Find multiple entities
   */
  async findMany(options?: FindOptions & {
    where?: Record<string, unknown>;
    orderBy?: Record<string, 'asc' | 'desc'>;
    skip?: number;
    take?: number;
  }): Promise<T[]> {
    const { where, orderBy, skip, take, ...findOptions } = options ?? {};

    return this.model.findMany({
      where: {
        ...this.getWhereClause(findOptions),
        ...where,
      },
      orderBy,
      skip,
      take,
    });
  }

  /**
   * Count entities
   */
  async count(options?: FindOptions & {
    where?: Record<string, unknown>;
  }): Promise<number> {
    const { where, ...findOptions } = options ?? {};

    return this.model.count({
      where: {
        ...this.getWhereClause(findOptions),
        ...where,
      },
    });
  }

  /**
   * Create a new entity
   */
  async create(data: CreateInput): Promise<T> {
    return this.model.create({
      data: data as any,
    });
  }

  /**
   * Update an entity with optimistic locking support
   */
  async update(
    where: { id: string },
    data: UpdateInput,
    options?: UpdateOptions<T>,
  ): Promise<T> {
    const entity = await this.findUnique(where, { includeDeleted: true });

    if (!entity) {
      throw new Error(`Entity not found: ${where.id}`);
    }

    if ((entity as any).deletedAt && !options?.expectedVersion) {
      throw new SoftDeletedError(where.id);
    }

    // Optimistic locking check
    if (options?.expectedVersion !== undefined) {
      if ((entity as any).version !== options.expectedVersion) {
        throw new OptimisticLockError(where.id, options.expectedVersion, (entity as any).version);
      }
    }

    // Increment version on update
    const versionedData: any = {
      ...data,
      version: { increment: 1 },
      ...(options?.updatedById && { updatedById: options.updatedById }),
    };

    return this.model.update({
      where,
      data: versionedData,
    });
  }

  /**
   * Soft-delete an entity
   */
  async delete(where: { id: string }, userId?: string): Promise<T> {
    const entity = await this.findUnique(where, { includeDeleted: true });

    if (!entity) {
      throw new Error(`Entity not found: ${where.id}`);
    }

    if ((entity as any).deletedAt) {
      throw new SoftDeletedError(where.id);
    }

    return this.model.update({
      where,
      data: {
        deletedAt: new Date(),
        ...(userId && { updatedById: userId }),
        version: { increment: 1 },
      },
    });
  }

  /**
   * Hard-delete an entity (use with caution)
   */
  async hardDelete(where: { id: string }): Promise<void> {
    await this.model.delete({
      where,
    });
  }

  /**
   * Restore a soft-deleted entity
   */
  async restore(where: { id: string }, userId?: string): Promise<T> {
    const entity = await this.findUnique(where, { includeDeleted: true });

    if (!entity) {
      throw new Error(`Entity not found: ${where.id}`);
    }

    if (!(entity as any).deletedAt) {
      return entity; // Already active
    }

    return this.model.update({
      where,
      data: {
        deletedAt: null,
        ...(userId && { updatedById: userId }),
        version: { increment: 1 },
      },
    });
  }

  /**
   * Check if an entity exists (excluding soft-deleted)
   */
  async exists(where: { id: string }): Promise<boolean> {
    const entity = await this.findUnique(where);
    return entity !== null;
  }

  /**
   * Upsert an entity
   */
  async upsert(
    where: { id: string },
    create: CreateInput,
    update: UpdateInput,
  ): Promise<T> {
    return this.model.upsert({
      where,
      create: create as any,
      update: update as any,
    });
  }
}

/**
 * Audit log helper for repositories
 */
export interface AuditLogEntry {
  userId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function logAudit(
  prisma: PrismaClient,
  entry: AuditLogEntry,
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action as any,
      entity: entry.entity,
      entityId: entry.entityId,
      oldData: entry.oldData ? (JSON.parse(JSON.stringify(entry.oldData)) as any) : null,
      newData: entry.newData ? (JSON.parse(JSON.stringify(entry.newData)) as any) : null,
      metadata: entry.metadata ? (JSON.parse(JSON.stringify(entry.metadata)) as any) : null,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
    },
  });
}
