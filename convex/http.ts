import { httpRouter } from "convex/server";
import { api } from "./_generated/api";
import { httpAction } from "./_generated/server";

const http = httpRouter();

// This route proves user identity and securely stores their credentials with client side encryption and returns a session id and token as cookies.
http.route({
  path: "/api/auth",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { username, password } = body;
      if (!(username && password)) {
        return new Response(
          JSON.stringify({
            error: "Missing required fields: username and password",
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": "true",
            },
          }
        );
      }

      const result = await ctx.runAction(api.auth.authenticateUser, {
        username,
        password,
      });

      if (!result.success) {
        return new Response(
          JSON.stringify({
            error: result.error,
            details: result.details,
          }),
          {
            status: result.status,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": "true",
            },
          }
        );
      }

      const maxAge = 604_800; // 7 days in seconds
      const cookieOptions = `Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax; Path=/`;
      const sessionIdCookie = `acadia_session_id=${result.uniqueId}; ${cookieOptions}`;
      const tokenCookie = `acadia_token=${result.token}; ${cookieOptions}`;

      return new Response(
        JSON.stringify({
          success: true,
          message: "Authentication successful",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": [sessionIdCookie, tokenCookie].join(", "),
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
          },
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Internal server error",
          details: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
          },
        }
      );
    }
  }),
});

export default http;
