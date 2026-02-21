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
        lvl: [],
        rsg: [],
        ft: "filters",
        sv: "calendar",
        st: "",
        q: "",
        page: 1,
      },
    });
  },
});
