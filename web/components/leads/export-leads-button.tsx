"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download } from "lucide-react";

import { exportLeadsCsv } from "lib/api-client";
import { Button } from "components/ui/button";

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function ExportLeadsButton({ botId }: { botId: string }) {
  const exportCsv = useMutation({
    mutationFn: () => exportLeadsCsv(botId),
    onSuccess: (blob) => {
      toast.success("Leads exported");
      downloadBlob(blob, `leads-${botId}.csv`);
    },
  });

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        disabled={exportCsv.isPending}
        onClick={() => exportCsv.mutate()}
      >
        <Download className="h-3.5 w-3.5" />
        {exportCsv.isPending ? "Exporting…" : "Export CSV"}
      </Button>
      {exportCsv.isError ? (
        <span className="text-xs text-red-600">
          {exportCsv.error instanceof Error ? exportCsv.error.message : "Could not export leads"}
        </span>
      ) : null}
    </div>
  );
}
