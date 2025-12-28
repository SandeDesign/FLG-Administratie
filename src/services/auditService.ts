import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  limit as firestoreLimit,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  AuditLog,
  ComplianceReport,
  DataRetentionPolicy,
  DataRetentionStatus,
  AuditExport,
  AuditAction,
  AuditEntityType,
} from '../types';

const convertTimestamps = (data: any) => {
  const converted = { ...data };

  if (converted.createdAt && typeof converted.createdAt.toDate === 'function') {
    converted.createdAt = converted.createdAt.toDate();
  }
  if (converted.period?.startDate && typeof converted.period.startDate.toDate === 'function') {
    converted.period.startDate = converted.period.startDate.toDate();
  }
  if (converted.period?.endDate && typeof converted.period.endDate.toDate === 'function') {
    converted.period.endDate = converted.period.endDate.toDate();
  }
  if (converted.generatedAt && typeof converted.generatedAt.toDate === 'function') {
    converted.generatedAt = converted.generatedAt.toDate();
  }
  if (converted.resolvedAt && typeof converted.resolvedAt.toDate === 'function') {
    converted.resolvedAt = converted.resolvedAt.toDate();
  }

  return converted;
};

const convertToTimestamps = (data: any) => {
  const converted = { ...data };

  if (converted.createdAt instanceof Date) {
    converted.createdAt = Timestamp.fromDate(converted.createdAt);
  }
  if (converted.period?.startDate instanceof Date) {
    converted.period.startDate = Timestamp.fromDate(converted.period.startDate);
  }
  if (converted.period?.endDate instanceof Date) {
    converted.period.endDate = Timestamp.fromDate(converted.period.endDate);
  }
  if (converted.generatedAt instanceof Date) {
    converted.generatedAt = Timestamp.fromDate(converted.generatedAt);
  }
  if (converted.resolvedAt instanceof Date) {
    converted.resolvedAt = Timestamp.fromDate(converted.resolvedAt);
  }

  return converted;
};

// Helper function to remove undefined values (Firestore doesn't accept undefined)
const removeUndefinedValues = (obj: any): any => {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedValues);
  }

  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = removeUndefinedValues(value);
    }
  }
  return cleaned;
};

export class AuditService {

  static async logAction(
    userId: string,
    action: AuditAction,
    entityType: AuditEntityType,
    entityId: string,
    options?: {
      companyId?: string;
      changes?: AuditLog['changes'];
      metadata?: AuditLog['metadata'];
      severity?: AuditLog['severity'];
      performedBy?: AuditLog['performedBy'];
    }
  ): Promise<string> {
    const auditLog: Omit<AuditLog, 'id'> = {
      userId,
      companyId: options?.companyId,
      action,
      entityType,
      entityId,
      changes: options?.changes,
      metadata: options?.metadata,
      severity: options?.severity || 'info',
      performedBy: options?.performedBy || {
        uid: userId,
        email: 'unknown',
        role: 'admin',
      },
      createdAt: new Date(),
    };

    const checksum = this.generateChecksum(auditLog);
    const auditLogData = removeUndefinedValues(convertToTimestamps({
      ...auditLog,
      checksum,
    }));

    const docRef = await addDoc(collection(db, 'auditLogs'), auditLogData);
    return docRef.id;
  }

  static async getAuditLogs(
    userId: string,
    options?: {
      companyId?: string;
      entityType?: AuditEntityType;
      entityId?: string;
      action?: AuditAction;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<AuditLog[]> {
    let q = query(
      collection(db, 'auditLogs'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    if (options?.companyId) {
      q = query(q, where('companyId', '==', options.companyId));
    }

    if (options?.entityType) {
      q = query(q, where('entityType', '==', options.entityType));
    }

    if (options?.entityId) {
      q = query(q, where('entityId', '==', options.entityId));
    }

    if (options?.action) {
      q = query(q, where('action', '==', options.action));
    }

    if (options?.limit) {
      q = query(q, firestoreLimit(options.limit));
    }

    const querySnapshot = await getDocs(q);
    let logs = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...convertTimestamps(doc.data()),
    } as AuditLog));

    if (options?.startDate || options?.endDate) {
      logs = logs.filter(log => {
        if (options.startDate && log.createdAt < options.startDate) return false;
        if (options.endDate && log.createdAt > options.endDate) return false;
        return true;
      });
    }

    return logs;
  }

  static async getEntityHistory(
    userId: string,
    entityType: AuditEntityType,
    entityId: string
  ): Promise<AuditLog[]> {
    return this.getAuditLogs(userId, {
      entityType,
      entityId,
    });
  }

  private static generateChecksum(auditLog: Omit<AuditLog, 'id' | 'checksum'>): string {
    const data = JSON.stringify({
      userId: auditLog.userId,
      action: auditLog.action,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      createdAt: auditLog.createdAt.toISOString(),
    });

    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    return hash.toString(36);
  }

  static async generateComplianceReport(
    userId: string,
    companyId: string,
    reportType: ComplianceReport['reportType'],
    period: { startDate: Date; endDate: Date }
  ): Promise<string> {
    const findings: ComplianceReport['findings'] = [];

    if (reportType === 'data_retention') {
      const retentionFindings = await this.checkDataRetention(companyId);
      findings.push(...retentionFindings);
    }

    if (reportType === 'audit_trail') {
      const auditFindings = await this.checkAuditTrail(userId, companyId, period);
      findings.push(...auditFindings);
    }

    const summary = {
      totalChecks: findings.length,
      passed: findings.filter(f => f.severity === 'info').length,
      warnings: findings.filter(f => f.severity === 'warning').length,
      critical: findings.filter(f => f.severity === 'critical').length,
    };

    const report: Omit<ComplianceReport, 'id'> = {
      companyId,
      userId,
      reportType,
      period,
      findings,
      summary,
      generatedBy: userId,
      generatedAt: new Date(),
      exportedFormats: [],
      createdAt: new Date(),
    };

    const reportData = convertToTimestamps(report);
    const docRef = await addDoc(collection(db, 'complianceReports'), reportData);
    return docRef.id;
  }

  private static async checkDataRetention(companyId: string): Promise<ComplianceReport['findings']> {
    const findings: ComplianceReport['findings'] = [];

    const sevenYearsAgo = new Date();
    sevenYearsAgo.setFullYear(sevenYearsAgo.getFullYear() - 7);

    const employeesQuery = query(
      collection(db, 'employees'),
      where('companyId', '==', companyId),
      where('createdAt', '<', Timestamp.fromDate(sevenYearsAgo))
    );

    const employeesSnapshot = await getDocs(employeesQuery);

    if (employeesSnapshot.size > 0) {
      findings.push({
        category: 'Data Retentie',
        severity: 'warning',
        description: `${employeesSnapshot.size} werknemersrecords zijn ouder dan 7 jaar en moeten worden gearchiveerd.`,
        recommendation: 'Archiveer oude werknemersrecords volgens het beleid.',
        resolved: false,
      });
    }

    return findings;
  }

  private static async checkAuditTrail(
    userId: string,
    companyId: string,
    period: { startDate: Date; endDate: Date }
  ): Promise<ComplianceReport['findings']> {
    const findings: ComplianceReport['findings'] = [];

    const auditLogs = await this.getAuditLogs(userId, {
      companyId,
      startDate: period.startDate,
      endDate: period.endDate,
    });

    const criticalActions = auditLogs.filter(log =>
      log.severity === 'critical' && log.action === 'delete'
    );

    if (criticalActions.length > 0) {
      findings.push({
        category: 'Audit Trail',
        severity: 'info',
        description: `${criticalActions.length} kritieke acties gelogd in de geselecteerde periode.`,
        resolved: true,
      });
    }

    const uniqueUsers = new Set(auditLogs.map(log => log.performedBy.uid));
    findings.push({
      category: 'Gebruikersactiviteit',
      severity: 'info',
      description: `${uniqueUsers.size} unieke gebruikers hebben acties uitgevoerd in deze periode.`,
      resolved: true,
    });

    return findings;
  }

  static async getDataRetentionStatus(companyId: string): Promise<DataRetentionStatus[]> {
    const entityTypes: AuditEntityType[] = [
      'employee',
      'payroll',
      'tax_return',
      'leave_request',
      'sick_leave',
      'expense',
    ];

    const statusPromises = entityTypes.map(async (entityType) => {
      const sevenYearsAgo = new Date();
      sevenYearsAgo.setFullYear(sevenYearsAgo.getFullYear() - 7);

      const collectionName = this.getCollectionNameForEntity(entityType);

      const totalQuery = query(
        collection(db, collectionName),
        where('companyId', '==', companyId)
      );

      const oldQuery = query(
        collection(db, collectionName),
        where('companyId', '==', companyId),
        where('createdAt', '<', Timestamp.fromDate(sevenYearsAgo))
      );

      const [totalSnapshot, oldSnapshot] = await Promise.all([
        getDocs(totalQuery),
        getDocs(oldQuery),
      ]);

      return {
        companyId,
        entityType,
        counts: {
          total: totalSnapshot.size,
          active: totalSnapshot.size - oldSnapshot.size,
          toArchive: oldSnapshot.size,
          toDelete: 0,
          archived: 0,
        },
        nextScheduledRun: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        calculatedAt: new Date(),
      };
    });

    return Promise.all(statusPromises);
  }

  private static getCollectionNameForEntity(entityType: AuditEntityType): string {
    const mapping: Record<AuditEntityType, string> = {
      employee: 'employees',
      company: 'companies',
      branch: 'branches',
      payroll: 'payrollCalculations',
      tax_return: 'taxReturns',
      leave_request: 'leaveRequests',
      sick_leave: 'sickLeave',
      expense: 'expenses',
      time_entry: 'timeEntries',
      settings: 'settings',
      user: 'users',
    };

    return mapping[entityType] || entityType + 's';
  }

  static async exportAuditLogs(
    userId: string,
    companyId: string,
    format: 'excel' | 'csv' | 'json',
    filters?: {
      startDate?: Date;
      endDate?: Date;
      entityType?: AuditEntityType;
    }
  ): Promise<string> {
    const exportRequest: Omit<AuditExport, 'id'> = {
      companyId,
      userId,
      exportType: 'audit_logs',
      filters: filters || {},
      format,
      filename: `audit-logs-${Date.now()}.${format}`,
      status: 'pending',
      requestedBy: userId,
      requestedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    };

    const exportData = convertToTimestamps(exportRequest);
    const docRef = await addDoc(collection(db, 'auditExports'), exportData);

    return docRef.id;
  }
}