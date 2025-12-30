import { useState } from "react";
import { Star, GitFork, MessageCircleCode } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Repository } from "@/types";
import { getLanguageColor } from "@/lib/colors";
import { ChatAssistant } from "@/components/dashboard/repository/ChatAssistant";

interface RepositoryCardProps {
  repo: Repository;
}

export const RepositoryCard = ({ repo }: RepositoryCardProps) => {
  const [isChatOpen, setIsChatOpen] = useState(false);

  const toggleChat = () => {
    setIsChatOpen(!isChatOpen);
  };

  return (
    <>
      <div className="flex items-center justify-between py-4">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium">{repo.name}</h2>
            <Badge className="bg-blue-100 text-blue-700" variant="outline">
              {repo.private ? "Private" : "Public"}
            </Badge>
          </div>
          <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: getLanguageColor(repo.language) }}
              />
              {repo.language}
            </div>
            <span className="flex items-center gap-1">
              <Star className="h-4 w-4" />
              {repo.stars}
            </span>
            <span className="flex items-center gap-1">
              <GitFork className="h-4 w-4" />
              {repo.forks}
            </span>
            <span>{repo.lastUpdated}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleChat}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Open code assistant"
          >
            <MessageCircleCode className="h-5 w-5 text-blue-600" />
          </button>
        </div>
      </div>

      {/* Render chat assistant when open */}
      {isChatOpen && (
        <ChatAssistant repo={repo.name} onClose={() => setIsChatOpen(false)} />
      )}
    </>
  );
};
