import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ credits: user.auditCredits });
  } catch (error) {
    console.error("Fetch credits error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
