export const DOC_COLUMNS: string[];
export function validateTask(input?: Record<string, unknown>): { title: string; status: string; assignee: unknown; doc_id: unknown; due_date: unknown; notes: unknown };
export function filterDocs(records: unknown[], filters?: Record<string, string>): unknown[];
export function toCsv(records: unknown[], columns?: string[]): string;
export function toJsonExport(records: unknown[]): { exported_at: string; count: number; data: unknown[] };
export function docCompleteness(doc?: Record<string, unknown>): Record<string, unknown>;
export function staleDocs(docs: unknown[], now?: Date, staleDays?: number): Record<string, unknown>;
export function publishReadiness(docs: unknown[]): Record<string, unknown>;
