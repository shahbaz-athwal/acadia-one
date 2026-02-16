import { AlertCircleIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";

interface SignInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SignInDialog({ open, onOpenChange }: SignInDialogProps) {
  const { error, isLoading, login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setPassword("");
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = await login(username.trim(), password);
    if (result.success) {
      setUsername("");
      setPassword("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>Sign in</DialogTitle>
          <DialogDescription>
            Sign in with your Acadia account to access your progress.
          </DialogDescription>
        </DialogHeader>

        <form className="contents" onSubmit={handleSubmit}>
          <DialogPanel className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="progress-login-username">Username</Label>
              <Input
                autoComplete="username"
                id="progress-login-username"
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Enter your Acadia username"
                required
                value={username}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="progress-login-password">Password</Label>
              <Input
                autoComplete="current-password"
                id="progress-login-password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                required
                type="password"
                value={password}
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 text-destructive text-sm">
                <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </DialogPanel>

          <DialogFooter>
            <Button
              onClick={() => handleOpenChange(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={isLoading} type="submit">
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
