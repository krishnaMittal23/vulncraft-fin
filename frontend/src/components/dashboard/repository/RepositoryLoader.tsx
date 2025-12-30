import { Star, GitFork } from "lucide-react";

export const RepositoryLoader = () => {
  return [...Array(5)].map((_, index) => (
    <div key={index} className="py-4 animate-pulse">
      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-40"></div>
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
        </div>
        <div className="mt-1 flex items-center gap-4">
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-gray-200 dark:bg-gray-700"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
          </div>
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 text-gray-200 dark:text-gray-700" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-8"></div>
          </div>
          <div className="flex items-center gap-1">
            <GitFork className="h-4 w-4 text-gray-200 dark:text-gray-700" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-8"></div>
          </div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
        </div>
      </div>
    </div>
  ));
};
