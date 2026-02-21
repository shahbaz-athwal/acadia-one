import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({
      to: "/explore",
      search: {
        term: [],
        dept: [],
        prof: [],
        day: [],
        rsg: [],
        ts: 0,
        te: 0,
        ft: "filters",
        sv: "calendar",
        st: "",
        q: "",
        page: 1,
      },
    });
  },
});
