import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { NodeType } from "@/types/workflow";

interface NodeConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeType: NodeType;
  initialData?: any;
  onSave: (data: any) => void;
}

const NodeConfigDialog = ({
  open,
  onOpenChange,
  nodeType,
  initialData,
  onSave,
}: NodeConfigDialogProps) => {
  // Email config
  const [email, setEmail] = useState(initialData?.email || "");

  // GitHub config
  const [repo, setRepo] = useState(initialData?.repo || "");

  // Slack config
  const [channel, setChannel] = useState(initialData?.channel || "");

  // GitHub repos
  const githubRepos: string[] = JSON.parse(
    localStorage.getItem("repos") || "[]"
  );

  const handleSave = () => {
    let configData = {};

    if (nodeType === "email") {
      configData = { email };
    } else if (nodeType === "github-issue") {
      configData = { repository: repo }; // Changed from 'repo' to 'repository' to match backend
    } else if (nodeType === "slack") {
      configData = { channel };
    }

    onSave(configData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Configure {nodeType.replace("-", " ")} Node</DialogTitle>
          <DialogDescription>
            {nodeType === "email" && "Set the email address for notifications."}
            {nodeType === "github-issue" &&
              "Select the GitHub repository for issue creation."}
            {nodeType === "slack" &&
              "Configure the Slack channel for notifications."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {nodeType === "email" && (
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
          )}

          {nodeType === "github-issue" && (
            <div className="space-y-2">
              <Label htmlFor="repo">GitHub Repository</Label>
              <Select value={repo} onValueChange={setRepo}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a repository" />
                </SelectTrigger>
                <SelectContent>
                  {githubRepos.map((repoName) => (
                    <SelectItem key={repoName} value={repoName}>
                      {repoName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {nodeType === "slack" && (
            <div className="space-y-2">
              <Label htmlFor="channel">Slack Channel</Label>
              <Input
                id="channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder="#general"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NodeConfigDialog;
