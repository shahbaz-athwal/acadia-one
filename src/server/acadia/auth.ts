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

function extractHtmlTitle(html: string | undefined) {
  const title = html?.match(/<title(?:\s[^>]*)?>(?<title>[\s\S]*?)<\/title>/iu)
    ?.groups?.title;

  return title?.replaceAll(/\s+/gu, " ").trim() ?? null;
}

export async function authenticateAcadiaStudent(
  username: string,
  password: string
) {
  const formData = new URLSearchParams({
    Password: password,
    UserName: username,
  });

  const loginResponse = await acadiaAuthFetch.raw<string, "text">("", {
    body: formData.toString(),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  let cookies = extractCookieValues(loginResponse.headers);
  const redirectLocation = loginResponse.headers.get("location");

  if (
    extractHtmlTitle(loginResponse._data) ===
    "Sign In - Acadia University Self-Service"
  ) {
    throw new Error("Acadia authentication failed.");
  }

  if (
    loginResponse.status !== 302 ||
    redirectLocation === null ||
    redirectLocation.length === 0
  ) {
    throw new Error("Acadia authentication did not return a redirect.");
  }

  const redirectResponse = await acadiaAuthFetch.raw<string, "text">(
    new URL(redirectLocation, loginResponse.url).toString(),
    {
      headers: {
        Cookie: cookies.join("; "),
      },
      method: "GET",
    }
  );

  if (
    extractHtmlTitle(redirectResponse._data) !==
    "Acadia University Self-Service"
  ) {
    throw new Error("Acadia authentication did not reach self-service.");
  }

  const redirectCookies = extractCookieValues(redirectResponse.headers);

  cookies = [...cookies, ...redirectCookies];

  return cookies.join("; ");
}
