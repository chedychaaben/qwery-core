import { runQuery } from './run-query';

export interface ViewSheetOptions {
  dbPath: string;
  sheetName?: string;
  limit?: number;
}

export interface ViewSheetResult {
  sheetName: string;
  totalRows: number;
  displayedRows: number;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  message: string;
}

/**
 * Views/displays the contents of a sheet.
 * This is a convenient way to quickly see what data is in a sheet without writing a SQL query.
 * Shows the first N rows by default (default 50).
 */
export const viewSheet = async (
  opts: ViewSheetOptions,
): Promise<ViewSheetResult> => {
  if (!opts.sheetName) {
    throw new Error(
      'sheetName is required. Use listViews to see available views.',
    );
  }
  const sheetName = opts.sheetName;
  const limit = opts.limit || 50;

  // First, get the total row count
  const countQuery = `SELECT COUNT(*) as total FROM "${sheetName}"`;
  const countResult = await runQuery({
    dbPath: opts.dbPath,
    query: countQuery,
  });

  const firstRow = countResult.rows[0];
  const totalRows =
    countResult.rows.length > 0 &&
    firstRow &&
    typeof firstRow.total === 'number'
      ? firstRow.total
      : 0;

  // Then, get the first N rows
  const viewQuery = `SELECT * FROM "${sheetName}" LIMIT ${limit}`;
  const viewResult = await runQuery({
    dbPath: opts.dbPath,
    query: viewQuery,
  });

  const displayedRows = viewResult.rows.length;
  const message =
    totalRows > limit
      ? `Showing first ${displayedRows} of ${totalRows} rows. Use runQuery to see more or apply filters.`
      : `Showing all ${displayedRows} rows.`;

  return {
    sheetName,
    totalRows,
    displayedRows,
    columns: viewResult.columns,
    rows: viewResult.rows,
    message,
  };
};
