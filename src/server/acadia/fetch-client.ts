import { ofetch } from "ofetch";

export const ACADIA_BASE_URL = "https://collss.acadiau.ca";

export const acadiaAuthFetch = ofetch.create({
  baseURL: new URL("/student/Account/Login", ACADIA_BASE_URL).toString(),
  ignoreResponseError: true,
  redirect: "manual",
  responseType: "text",
  retry: false,
});

export const createAcadiaPortalFetch = (cookies: string) =>
  ofetch.create({
    baseURL: ACADIA_BASE_URL,
    onRequest({ options }) {
      options.headers.set("Accept", "application/json");
      options.headers.set("Cookie", cookies);
    },
    retry: false,
  });
