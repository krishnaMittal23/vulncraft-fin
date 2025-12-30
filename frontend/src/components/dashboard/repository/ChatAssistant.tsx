import React, { useState, useEffect, useRef } from "react";
import { X, Send, Loader2, Maximize2, Minimize2 } from "lucide-react";
import { useGithubCodeAnalysis } from "@/hooks/useGithubCodeAnalysis";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTheme } from "@/components/shared/ThemeProvider";

interface ChatAssistantProps {
  repo: string;
  onClose: () => void;
}

export const ChatAssistant = ({ repo, onClose }: ChatAssistantProps) => {
  const {
    analysis,
    loadingRepo,
    loadingAnalysis,
    error,
    fetchRepositoryContents,
    analyzeCode,
  } = useGithubCodeAnalysis();

  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [message, setMessage] = useState<string>("");
  const [isExpanded, setIsExpanded] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = () => {
    if (message.trim()) {
      analyzeCode(message);
      setMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  useEffect(() => {
    // Load repository contents when component mounts
    fetchRepositoryContents(repo).catch((err) => {
      // Error already handled in the hook
      console.log(err);
    });
  }, [repo, fetchRepositoryContents]);

  useEffect(() => {
    // Scroll to bottom when analysis updates
    if (chatContainerRef.current && analysis) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [analysis]);

  // Handle responsive layout
  useEffect(() => {
    const handleResize = () => {
      // Auto-collapse on small screens when resizing
      if (window.innerWidth < 640 && isExpanded) {
        setIsExpanded(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isExpanded]);

  return (
    <Card
      className={`
        fixed z-50 shadow-xl flex flex-col transition-all duration-200
        ${isDark ? "bg-zinc-950" : "bg-white"}
        ${
          isExpanded
            ? "inset-4 h-auto"
            : "bottom-6 right-6 w-full sm:w-96 h-[40rem]"
        }
      `}
    >
      <CardHeader className="p-3 bg-amber-400 text-white flex-shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="font-medium truncate">Code Assistant - {repo}</h3>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleExpand}
              className="text-white h-8 w-8 p-0"
            >
              {isExpanded ? (
                <Minimize2 className="h-5 w-5" />
              ) : (
                <Maximize2 className="h-5 w-5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-white h-8 w-8 p-0"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <ScrollArea className="flex-1 overflow-y-auto">
        <CardContent className="p-4 space-y-4">
          {loadingRepo ? (
            <div className="flex flex-col items-center justify-center h-32">
              <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-2" />
              <p className="text-muted-foreground">
                Loading repository files...
              </p>
            </div>
          ) : error ? (
            <div className="bg-destructive/10 text-destructive p-3 rounded">
              {error}
            </div>
          ) : (
            <>
              {/* Welcome message */}
              <div
                className={`${
                  isDark ? "bg-zinc-800" : "bg-muted"
                } p-3 rounded-lg rounded-tl-none max-w-[85%]`}
              >
                <p>
                  Hello! I'm your code assistant for {repo}. Ask me anything
                  about your code, and I'll analyze it for you.
                </p>
              </div>

              {/* Code analysis results */}
              {loadingAnalysis ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-2" />
                  <p className="text-muted-foreground">
                    Analyzing your code...
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This might take a moment
                  </p>
                </div>
              ) : analysis ? (
                <Card
                  className={`${isDark ? "bg-zinc-900 border-zinc-800" : ""}`}
                >
                  <CardHeader className="pb-2">
                    <h4 className="font-medium">Code Analysis</h4>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm">{analysis.response.summary}</p>
                    </div>

                    {analysis.response.key_features.length > 0 && (
                      <div>
                        <h5 className="text-sm font-medium mb-1">
                          Key Features
                        </h5>
                        <ul className="list-disc list-inside text-sm text-muted-foreground pl-1">
                          {analysis.response.key_features.map(
                            (feature, index) => (
                              <li key={index}>{feature}</li>
                            )
                          )}
                        </ul>
                      </div>
                    )}

                    {analysis.response.potential_issues.length > 0 && (
                      <div>
                        <h5 className="text-sm font-medium text-destructive mb-1">
                          Potential Issues
                        </h5>
                        <ul className="list-disc list-inside text-sm text-muted-foreground pl-1">
                          {analysis.response.potential_issues.map(
                            (issue, index) => (
                              <li key={index}>{issue}</li>
                            )
                          )}
                        </ul>
                      </div>
                    )}

                    {analysis.response.best_practices.length > 0 && (
                      <div>
                        <h5 className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">
                          Best Practices
                        </h5>
                        <ul className="list-disc list-inside text-sm text-muted-foreground pl-1">
                          {analysis.response.best_practices.map(
                            (practice, index) => (
                              <li key={index}>{practice}</li>
                            )
                          )}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : null}
            </>
          )}
        </CardContent>
      </ScrollArea>

      <Separator />
      <CardFooter className="p-3 flex-shrink-0">
        <div className="flex items-center w-full gap-2">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your code..."
            className="flex-1 resize-none h-10 max-h-32"
            rows={1}
          />
          <Button
            onClick={handleSendMessage}
            disabled={loadingAnalysis || loadingRepo || !message.trim()}
            size="icon"
            className="h-10"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};
