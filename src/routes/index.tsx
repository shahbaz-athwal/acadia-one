import { createFileRoute } from "@tanstack/react-router";

const RouteComponent = () => <div className="text-4xl">Hello "/"!</div>;
export const Route = createFileRoute("/")({
  component: RouteComponent,
});
