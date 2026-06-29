import { ofetch } from "ofetch";

const ACADIA_BASE_URL = "https://collss.acadiau.ca";
const ACADIA_LOGIN_PATH = "/student/Account/Login";
const MIN_AUTH_COOKIE_COUNT = 6;

const acadiaFetch = ofetch.create({
  ignoreResponseError: true,
  redirect: "manual",
  responseType: "text",
  retry: false,
});

type HeadersWithSetCookie = Headers & { getSetCookie?: () => string[] };

export const authenticateAcadiaStudent = async (
  username: string,
  password: string
): Promise<string> => {
  const formData = new URLSearchParams({
    Password: password,
    UserName: username,
  });

  const loginResponse = await acadiaFetch.raw(
    new URL(ACADIA_LOGIN_PATH, ACADIA_BASE_URL).toString(),
    {
      body: formData.toString(),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    }
  );

  let cookies =
    (loginResponse.headers as HeadersWithSetCookie)
      .getSetCookie?.()
      .map((cookie) => cookie.split(";")[0]?.trim())
      .filter(
        (cookie): cookie is string => cookie !== undefined && cookie.length > 0
      ) ?? [];
  const redirectLocation = loginResponse.headers.get("location");

  if (
    loginResponse.status === 302 &&
    redirectLocation !== null &&
    redirectLocation.length > 0
  ) {
    const redirectResponse = await acadiaFetch.raw(
      new URL(redirectLocation, ACADIA_BASE_URL).toString(),
      {
        headers: {
          Cookie: cookies.join("; "),
        },
        method: "GET",
      }
    );

    const redirectCookies =
      (redirectResponse.headers as HeadersWithSetCookie)
        .getSetCookie?.()
        .map((cookie) => cookie.split(";")[0]?.trim())
        .filter(
          (cookie): cookie is string =>
            cookie !== undefined && cookie.length > 0
        ) ?? [];

    cookies = [...cookies, ...redirectCookies];
  }

  if (cookies.length < MIN_AUTH_COOKIE_COUNT) {
    throw new Error("Failed to authenticate with Acadia.");
  }

  return cookies.join("; ");
};
