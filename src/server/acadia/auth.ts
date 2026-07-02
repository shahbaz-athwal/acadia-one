import { acadiaAuthFetch } from "./fetch-client";

function extractCookieValues(headers: Headers) {
  return (
    (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ??
    []
  )
    .map((cookie) => cookie.split(";")[0]?.trim())
    .filter(
      (cookie): cookie is string => cookie !== undefined && cookie.length > 0
    );
}

export async function authenticateAcadiaStudent(
  username: string,
  password: string
) {
  const formData = new URLSearchParams({
    Password: password,
    UserName: username,
  });

  const loginResponse = await acadiaAuthFetch.raw("", {
    body: formData.toString(),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  let cookies = extractCookieValues(loginResponse.headers);
  const redirectLocation = loginResponse.headers.get("location");

  if (
    loginResponse.status === 302 &&
    redirectLocation !== null &&
    redirectLocation.length > 0
  ) {
    const redirectResponse = await acadiaAuthFetch.raw(
      new URL(redirectLocation, loginResponse.url).toString(),
      {
        headers: {
          Cookie: cookies.join("; "),
        },
        method: "GET",
      }
    );

    const redirectCookies = extractCookieValues(redirectResponse.headers);

    cookies = [...cookies, ...redirectCookies];
  }

  return cookies.join("; ");
}
