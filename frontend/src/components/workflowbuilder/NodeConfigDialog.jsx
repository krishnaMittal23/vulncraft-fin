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

const NodeConfigDialog = ({
  open, onOpenChange, nodeType, initialData, onSave,
}) => {
  // Email config
  const [email, setEmail] = useState(initialData?.email || "");

  // GitHub config
  const [repo, setRepo] = useState(initialData?.repo || "");

  // Slack config
  const [channel, setChannel] = useState(initialData?.channel || "");
  const [webhookUrl, setWebhookUrl] = useState(initialData?.webhookUrl || "");

  // GitHub repos from localStorage
  const githubRepos = JSON.parse(
    localStorage.getItem("repos") || "[]"
  );

  const handleSave = () => {
    let configData = {};

    if (nodeType === "email") {
      configData = { email };
    } else if (nodeType === "github-issue") {
      configData = { repository: repo };
    } else if (nodeType === "slack") {
      configData = { webhookUrl: webhookUrl.trim(), channel: channel.trim() };
    }

    onSave(configData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            Configure {nodeType.replace("-", " ")} Node
          </DialogTitle>
          <DialogDescription>
            {nodeType === "email" && "Set the email address for notifications."}
            {nodeType === "github-issue" &&
              "Select the GitHub repository for issue creation."}
            {nodeType === "slack" &&
              "Paste a Slack incoming-webhook URL to post scan results."}
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
            <>
              <div className="space-y-2">
                <Label htmlFor="webhookUrl">Slack Incoming Webhook URL</Label>
                <Input
                  id="webhookUrl"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://hooks.slack.com/services/T.../B.../xxxx"
                />
                <p className="text-xs text-muted-foreground">
                  Create one at api.slack.com → Incoming Webhooks. The webhook already
                  targets a channel, so this is all that&apos;s needed.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="channel">Channel label (optional)</Label>
                <Input
                  id="channel"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  placeholder="#security"
                />
              </div>
            </>
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
