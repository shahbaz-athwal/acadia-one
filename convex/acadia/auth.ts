"use node";

import https from "node:https";

import axios, { type AxiosInstance } from "axios";

export const BASE_URL = "https://collss.acadiau.ca";

export const clientConfig = {
  baseURL: BASE_URL,
  validateStatus: (status: number) => status >= 200 && status < 500,
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
};

export const createClient = (config: typeof clientConfig = clientConfig): AxiosInstance =>
  axios.create(config);

const authClient = createClient();

export async function authenticateWithAxios(username: string, password: string): Promise<string> {
  const formData = new URLSearchParams();
  formData.append("UserName", username);
  formData.append("Password", password);

  const response = await authClient.post("/student/Account/Login", formData.toString(), {
    maxRedirects: 0,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  const setCookieHeaders = response.headers["set-cookie"];
  let allCookies: string[] = [];

  if (setCookieHeaders) {
    allCookies = setCookieHeaders
      .map((cookieHeader) => {
        if (!cookieHeader) {
          return null;
        }
        const cookiePart = cookieHeader.split(";")[0];
        return cookiePart;
      })
      .filter((cookie): cookie is string => cookie !== null);
  }

  if (response.status === 302 && response.headers.location) {
    const cookieString = allCookies.join("; ");

    const redirectResponse = await authClient.get(response.headers.location, {
      maxRedirects: 0,
      headers: {
        Cookie: cookieString,
      },
    });

    if (redirectResponse.headers["set-cookie"]) {
      const redirectCookies = redirectResponse.headers["set-cookie"]
        .map((cookieHeader) => {
          if (!cookieHeader) {
            return null;
          }
          return cookieHeader.split(";")[0];
        })
        .filter((cookie): cookie is string => cookie !== null);

      allCookies = [...allCookies, ...redirectCookies];
    }
  }

  if (allCookies.length < 6) {
    console.log("Failed to authenticate with Acadia.", allCookies);
    throw new Error("Failed to authenticate with Acadia.");
  }

  return allCookies.join("; ");
}

export const DEFAULT_AUTH_TIMEOUT_MS = 10 * 60 * 1000;

export function isAcadiaSessionExpired(lastAcadiaAuth: number): boolean {
  return Date.now() - lastAcadiaAuth > DEFAULT_AUTH_TIMEOUT_MS;
}
