import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { api } from "convex/_generated/api";

function YourProgress({
  sessionId,
  tokenHash,
}: {
  sessionId: string;
  tokenHash: string | null;
}) {
  const { data: userData } = useSuspenseQuery(
    convexQuery(api.sessions.getUserData, {
      sessionId,
      tokenHash: tokenHash ?? "",
    })
  );
  console.log(userData);
  return (
    <div>
      <h1>Your Progress</h1>
    </div>
  );
}

export default YourProgress;
