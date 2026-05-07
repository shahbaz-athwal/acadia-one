import { TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { SignInDialog } from "@/components/explore/filters/sign-in-dialog";
import YourProgress from "@/components/explore/filters/your-progress";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/use-auth";

export function ProgressTab() {
  const { isAuthenticated, userDataStatus } = useAuth();
  const [isSignInOpen, setIsSignInOpen] = useState(false);

  let content: React.ReactNode;

  if (!isAuthenticated) {
    content = (
      <Empty className="h-2/3 gap-4 p-4">
        <EmptyHeader>
          <EmptyTitle className="font-medium font-sans text-sm sm:text-xs">
            You are not logged in
          </EmptyTitle>
          <EmptyDescription className="text-xs">
            Sign in to view your progress information.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => setIsSignInOpen(true)} size="sm">
            Log in
          </Button>
        </EmptyContent>
      </Empty>
    );
  } else if (userDataStatus === "ready") {
    content = <YourProgress />;
  } else if (userDataStatus === "error") {
    content = (
      <Empty className="h-2/3 gap-4 p-4">
        <EmptyMedia className="mb-0" variant="default">
          <TriangleAlertIcon className="size-6" />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle className="font-medium font-sans text-sm sm:text-xs">
            Unable to load your progress
          </EmptyTitle>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => setIsSignInOpen(true)} size="sm">
            Try again
          </Button>
        </EmptyContent>
      </Empty>
    );
  } else {
    content = (
      <Empty className="h-2/3 gap-4 p-4">
        <EmptyMedia className="mb-0" variant="default">
          <Spinner className="size-4 opacity-50" />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle className="font-medium font-sans text-sm sm:text-xs">
            Importing your degree progress
          </EmptyTitle>
          <EmptyDescription className="text-xs">This may take a few seconds...</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      {content}
      <SignInDialog onOpenChange={setIsSignInOpen} open={isSignInOpen} />
    </>
  );
}
