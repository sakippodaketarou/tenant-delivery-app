import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL が設定されていません。");
}

if (!serviceRoleKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY が設定されていません。");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

function createQrValue(name: string) {
  const safeName = name
    .replace(/\s/g, "")
    .replace(/[^\w\u3040-\u30ff\u3400-\u9fff]/g, "")
    .toUpperCase();

  const random = Math.random().toString(36).slice(2, 8).toUpperCase();

  return `STAFF_${safeName}_${random}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      company_id,
      name,
      signature,
      department,
      email,
      phone,
      password,
      role,
    } = body;

    if (!company_id) {
      return NextResponse.json(
        { error: "company_id がありません。" },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: "名前がありません。" },
        { status: 400 }
      );
    }

    if (!signature) {
      return NextResponse.json(
        { error: "署名がありません。" },
        { status: 400 }
      );
    }

    if (!department) {
      return NextResponse.json(
        { error: "部署がありません。" },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: "メールアドレスがありません。" },
        { status: 400 }
      );
    }

    if (!password || String(password).length < 6) {
      return NextResponse.json(
        { error: "パスワードは6文字以上で入力してください。" },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        { error: "このメールアドレスは既にprofilesに登録されています。" },
        { status: 400 }
      );
    }

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          name,
          signature,
          department,
          role: role ?? "tenant_staff",
        },
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message ?? "Authユーザー作成に失敗しました。" },
        { status: 500 }
      );
    }

    const userId = authData.user.id;
    const qrValue = createQrValue(signature || name);

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: userId,
        company_id,
        name,
        signature,
        department,
        email: normalizedEmail,
        phone: phone || null,
        role: role ?? "tenant_staff",
        qr_value: qrValue,
      });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);

      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user_id: userId,
      qr_value: qrValue,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "サーバーエラーが発生しました。" },
      { status: 500 }
    );
  }
}