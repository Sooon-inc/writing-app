import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(req: NextRequest) {
  console.log("[auth/callback] called, url:", req.nextUrl.toString());

  const code = req.nextUrl.searchParams.get("code") ?? "";
  const stateRaw = req.nextUrl.searchParams.get("state") ?? "{}";
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    console.error("[auth/callback] Google returned error:", error);
    return new NextResponse(`Google OAuth Error: ${error}`, { status: 400 });
  }

  if (!code) {
    console.error("[auth/callback] no code in request");
    return new NextResponse("Missing code parameter", { status: 400 });
  }

  let projectId = "";
  let sheetType = "";
  try {
    const state = JSON.parse(stateRaw);
    projectId = state.projectId ?? "";
    sheetType = state.sheetType ?? "";
  } catch {
    projectId = stateRaw;
  }
  console.log("[auth/callback] projectId:", projectId, "sheetType:", sheetType);

  // リクエストのoriginからコールバックURLを動的生成
  const callbackUrl = `${req.nextUrl.origin}/api/auth/google/callback`;
  console.log("[auth/callback] callbackUrl:", callbackUrl);

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl
  );

  let tokens;
  try {
    console.log("[auth/callback] calling getToken...");
    const tokenPromise = oauth2Client.getToken(code);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("getToken timeout after 15s")), 15000)
    );
    const result = await Promise.race([tokenPromise, timeoutPromise]);
    tokens = result.tokens;
    console.log("[auth/callback] getToken success, has access_token:", !!tokens.access_token);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[auth/callback] getToken failed:", msg);
    const errUrl = new URL(`/projects/${projectId || ""}`, req.nextUrl.origin);
    errUrl.searchParams.set("authError", msg);
    return NextResponse.redirect(errUrl);
  }

  const redirectUrl = new URL(`/projects/${projectId}`, req.nextUrl.origin);
  if (sheetType) redirectUrl.searchParams.set("openSheet", sheetType);

  const res = NextResponse.redirect(redirectUrl);

  if (tokens.access_token) {
    res.cookies.set("g_access_token", tokens.access_token, {
      httpOnly: true,
      path: "/",
      maxAge: 3600,
    });
  }
  if (tokens.refresh_token) {
    res.cookies.set("g_refresh_token", tokens.refresh_token, {
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return res;
}
