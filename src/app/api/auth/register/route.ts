// ===================================
// Registration API Route
// POST /api/auth/register
// ===================================

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, managerName } = body;

    // ─── Validation ───────────────────────────────────
    if (!email || !password || !managerName) {
      return NextResponse.json(
        { error: "Email, пароль и имя менеджера обязательны" },
        { status: 400 }
      );
    }

    if (typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { error: "Пароль должен быть не менее 6 символов" },
        { status: 400 }
      );
    }

    if (typeof managerName !== "string" || managerName.trim().length < 2) {
      return NextResponse.json(
        { error: "Имя менеджера должно быть не менее 2 символов" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json(
        { error: "Некорректный формат email" },
        { status: 400 }
      );
    }

    // ─── Check if email already exists ────────────────
    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Пользователь с таким email уже существует" },
        { status: 409 } // 409 Conflict
      );
    }

    // ─── Hash password ────────────────────────────────
    // saltRounds: 12 is a good balance of security vs speed
    const passwordHash = await bcrypt.hash(password, 12);

    // ─── Create user ──────────────────────────────────
    const newUser = await db.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        managerName: managerName.trim(),
        role: "USER", // Default role
      },
      // Only return safe fields — NEVER return passwordHash
      select: {
        id: true,
        email: true,
        managerName: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        message: "Пользователь успешно зарегистрирован",
        user: newUser,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[REGISTER] Error:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
