import React from "react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  title: string;
  description: string;
  buttonText?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
}

const EmptyState = ({
  title,
  description,
  buttonText,
  onClick,
  icon,
}: EmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center animate-fade-in">
      <div className="bg-muted/50 w-20 h-20 rounded-full flex items-center justify-center mb-6 text-muted-foreground">
        {icon || (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-10 h-10"
          >
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        )}
      </div>
      <h3 className="text-lg font-semibold mb-2 text-foreground">{title}</h3>
      <p className="text-muted-foreground max-w-sm mb-6">{description}</p>
      {buttonText && onClick && (
        <Button onClick={onClick} size="lg" className="px-6 animate-scale-in">
          {buttonText}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
