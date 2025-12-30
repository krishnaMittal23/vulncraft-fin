import { Star, GitFork, Lock, Unlock, GitBranch, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Repository } from "@/types";
import { getLanguageColor } from "@/lib/colors";

interface RepositoryBoxCardProps {
  repo: Repository;
}

export const RepositoryBoxCard = ({ repo }: RepositoryBoxCardProps) => {
  return (
    <Card className="cursor-pointer hover:shadow-lg hover:shadow-white/10 transition-all duration-300 ease-in-out bg-zinc-900/90 backdrop-blur-xl border-zinc-700/50 flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg text-white font-bold truncate">
              {repo.name}
            </CardTitle>
            <CardDescription className="text-gray-400 text-xs mt-1 flex items-center gap-2">
              <a 
                href={repo.url} 
                target="_blank" 
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="hover:text-white transition-colors"
              >
                View on GitHub <ExternalLink className="h-3 w-3 inline" />
              </a>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {repo.private ? (
              <Lock className="h-4 w-4 text-gray-400" />
            ) : (
              <Unlock className="h-4 w-4 text-gray-400" />
            )}
          </div>
        </div>
      </CardHeader>

        <CardContent className="space-y-3 flex-1 flex flex-col">
          {/* Description */}
          {repo.description && (
            <p className="text-sm text-gray-300 line-clamp-2 flex-1">
              {repo.description}
            </p>
          )}

          {/* Language Badge */}
          {repo.language && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: getLanguageColor(repo.language) }}
                />
                <Badge variant="outline" className="text-xs border-zinc-600/50 text-gray-300">
                  {repo.language}
                </Badge>
              </div>
              <Badge className="text-xs" variant="outline">
                {repo.private ? "Private" : "Public"}
              </Badge>
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3" />
              <span>{repo.stars}</span>
            </div>
            <div className="flex items-center gap-1">
              <GitFork className="h-3 w-3" />
              <span>{repo.forks}</span>
            </div>
            <div className="flex items-center gap-1">
              <GitBranch className="h-3 w-3" />
              <span className="truncate">main</span>
            </div>
          </div>

          {/* Updated Date */}
          <div className="text-xs text-gray-500 pt-2 border-t border-zinc-800">
            Updated {repo.lastUpdated}
          </div>
        </CardContent>
      </Card>
  );
};
