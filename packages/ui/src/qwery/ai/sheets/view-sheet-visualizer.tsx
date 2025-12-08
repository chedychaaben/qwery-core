import { DataGrid } from '../data-grid';
import { SheetIcon } from 'lucide-react';

export interface ViewSheetData {
  sheetName: string;
  totalRows: number;
  displayedRows: number;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  message: string;
}

interface ViewSheetVisualizerProps {
  data: ViewSheetData;
}

export function ViewSheetVisualizer({ data }: ViewSheetVisualizerProps) {
  const { sheetName, totalRows, displayedRows, columns, rows } = data;
  const isPartial = displayedRows < totalRows;

  return (
    <div className="min-w-0 space-y-3 p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="border-foreground/10 flex size-9 shrink-0 items-center justify-center rounded-lg border-2">
            <SheetIcon className="text-foreground size-4.5" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h3 className="text-foreground truncate text-base font-semibold">
              {sheetName}
            </h3>
            <p className="text-muted-foreground text-sm">
              {isPartial
                ? `Showing ${displayedRows.toLocaleString()} of ${totalRows.toLocaleString()} rows`
                : `${totalRows.toLocaleString()} row${totalRows !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
      </div>

      {/* Data Grid */}
      <div className="border-border/60 overflow-hidden rounded-lg border shadow-sm">
        <DataGrid columns={columns} rows={rows} />
      </div>
    </div>
  );
}
