export type AnomalySeverity = "CRITICAL" | "WARNING" | "INFO";

export type AnomalyCategory =
  | "SALES"
  | "PURCHASE"
  | "CASH"
  | "INVENTORY"
  | "SUBLEDGER"
  | "JOURNAL"
  | "DATE"
  | "SYNC";

export interface AnomalyItem {
  id: string;
  code: string;
  category: AnomalyCategory;
  severity: AnomalySeverity;
  title: string;
  description: string;
  referenceKey?: string;
  detectedValue?: any;
  expectedValue?: any;
  discrepancy?: number;
  remediation: string;
}

export interface AuditFinancialMetrics {
  totalSalesCount: number;
  totalSalesAmount: number;
  totalPurchaseCount: number;
  totalPurchaseAmount: number;
  totalJournalCount: number;
  totalItemCount: number;
  unjournaledSalesCount: number;
  unjournaledSalesAmount: number;
  unjournaledPurchaseCount: number;
  unjournaledPurchaseAmount: number;
  salesBelowCostCount: number;
  salesBelowCostLoss: number;
  negativeCashAmount: number;
}

export interface AuditSummary {
  timestamp: string;
  database: string;
  totalAnomalies: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  categoryStats: Record<AnomalyCategory, number>;
  metrics: AuditFinancialMetrics;
  items: AnomalyItem[];
}
