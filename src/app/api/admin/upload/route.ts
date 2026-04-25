import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

// Increase body size limit to 10MB for high-quality phone photos
export const config = {
  api: {
    bodyParser: false,
    responseLimit: "10mb",
  },
};

export async function POST(req: Request) {
  console.log("[UPLOAD] Request received");
  try {
    const session = await getServerSession(authOptions);
    console.log("[UPLOAD] Session role:", session?.user?.role);

    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    console.log("[UPLOAD] File received:", file?.name, file?.size, file?.type);

    if (!file) {
      return NextResponse.json({ error: "Файл не найден в запросе" }, { status: 400 });
    }

    // Validate file size (max 10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `Файл слишком большой (${(file.size / 1024 / 1024).toFixed(1)}MB). Максимум: 10MB` },
        { status: 400 }
      );
    }

    // Validate MIME type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Допускаются только изображения" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create unique file name (sanitize to ASCII only)
    const timestamp = Date.now();
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const filename = `${timestamp}.${ext}`;

    const uploadDir = join(process.cwd(), "public", "match-previews");

    if (!existsSync(uploadDir)) {
      console.log("[UPLOAD] Creating directory:", uploadDir);
      await mkdir(uploadDir, { recursive: true });
    }

    const filepath = join(uploadDir, filename);
    await writeFile(filepath, buffer);
    console.log("[UPLOAD] File saved:", filepath);

    const fileUrl = `/match-previews/${filename}`;
    console.log("[UPLOAD] Returning URL:", fileUrl);

    return NextResponse.json({ url: fileUrl });
  } catch (error: any) {
    console.error("[UPLOAD_ERROR]", error?.message, error?.stack);
    return NextResponse.json(
      { error: `Ошибка загрузки: ${error?.message ?? "неизвестная ошибка"}` },
      { status: 500 }
    );
  }
}
