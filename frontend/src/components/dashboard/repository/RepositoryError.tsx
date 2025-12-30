interface RepositoryErrorProps {
  error: Error;
  onRetry: () => void;
}

export const RepositoryError = ({ error, onRetry }: RepositoryErrorProps) => {
  return (
    <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8 flex flex-col items-center justify-center h-full bg-white dark:bg-zinc-950 rounded-xl">
      <div className="text-center">
        <h3 className="text-lg font-medium text-red-600 dark:text-red-400">
          Failed to load repositories
        </h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {error.message}
        </p>
        <button
          onClick={onRetry}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
};
