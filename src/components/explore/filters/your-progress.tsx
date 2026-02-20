import { useSuspenseQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { userDataQuery } from "@/queries/explore";

function YourProgress() {
  const { sessionId, tokenHash } = useAuth();
  const { data: userData } = useSuspenseQuery(
    userDataQuery(sessionId, tokenHash)
  );
  console.log(userData);
  return (
    <div>
      <h1>Your Progress</h1>
    </div>
  );
}

export default YourProgress;
