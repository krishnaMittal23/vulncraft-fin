import { AlertTriangle, RefreshCw } from "lucide-react";

interface RepositoryErrorProps {
  error: Error;
  onRetry: () => void;
}

export const RepositoryError = ({ error, onRetry }: RepositoryErrorProps) => {
  return (
    <div
      className="flex h-full flex-1 flex-col items-center justify-center rounded-xl bg-[#09090b] px-4 py-6 text-[#e5e1e4] sm:px-6 lg:px-8"
      style={{ fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif" }}
    >
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-xl border border-[#dc2626]/30 bg-[#131315] p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#dc2626]/10 text-[#ff6b6b]">
          <AlertTriangle className="h-7 w-7" />
        </div>

        <div>
          <h3 className="text-lg font-bold text-[#ff6b6b]">Sync Failed</h3>
          <p className="mt-2 text-sm text-[#bccbb9]/80">{error.message}</p>
        </div>

        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-lg border border-[#3f3f46] px-6 py-2 text-sm font-bold text-[#e5e1e4] transition-all hover:bg-[#27272a] active:scale-95"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Retry</span>
        </button>
      </div>
    </div>
  );
};
