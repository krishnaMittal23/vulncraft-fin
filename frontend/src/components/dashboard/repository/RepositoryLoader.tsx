export const RepositoryLoader = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
      {[...Array(6)].map((_, index) => (
        <div
          key={index}
          className="flex flex-col gap-6 rounded-xl border border-[#27272a]/60 bg-[#131315]/50 p-5"
        >
          {/* Header row */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 animate-pulse rounded bg-[#27272a]" />
              <div className="h-6 w-32 animate-pulse rounded bg-[#27272a]" />
            </div>
            <div className="h-6 w-16 animate-pulse rounded bg-[#27272a]" />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <div className="h-4 w-full animate-pulse rounded bg-[#27272a]" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-[#27272a]" />
          </div>

          {/* Footer row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 animate-pulse rounded-full bg-[#27272a]" />
              <div className="h-4 w-16 animate-pulse rounded bg-[#27272a]" />
            </div>
            <div className="h-9 w-24 animate-pulse rounded-lg bg-[#27272a]" />
          </div>
        </div>
      ))}
    </div>
  );
};
