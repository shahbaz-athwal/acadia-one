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
        ts: 7 * 60 + 30,
        te: 21 * 60 + 30,
        ft: "filters",
        st: "",
        q: "",
        page: 1,
      },
    });
  },
});
