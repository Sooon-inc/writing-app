import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("g_access_token")?.value;
  const folderAccess = cookieStore.get("g_drive_folder_access")?.value;
  if (!token || folderAccess !== "1") {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true });
}
