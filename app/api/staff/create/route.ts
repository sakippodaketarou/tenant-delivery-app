import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { name, department, email, phone, password, companyId } = body;

    if (!name || !department || !email || !password || !companyId) {
      return NextResponse.json(
        { error: "必要項目が不足しています。" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    const user = authData.user;

    const qrValue = `STAFF_${user.id.slice(0, 8).toUpperCase()}`;

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: user.id,
        company_id: companyId,
        name,
        department,
        phone: phone || null,
        email,
        role: "tenant_staff",
        qr_value: qrValue,
      });

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "スタッフ作成に失敗しました。" },
      { status: 500 }
    );
  }
}