import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Supabase環境変数が不足しています。");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
const resend = resendApiKey ? new Resend(resendApiKey) : null;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const companyName = String(body.companyName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const phone = String(body.phone ?? "").trim();
    const password = String(body.password ?? "");

    if (!companyName) {
      return NextResponse.json(
        { error: "会社名を入力してください。" },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: "メールアドレスを入力してください。" },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: "パスワードは6文字以上で入力してください。" },
        { status: 400 }
      );
    }

    const { data: existingCompany, error: companyCheckError } =
      await supabaseAdmin
        .from("companies")
        .select("id")
        .eq("email", email)
        .maybeSingle();

    if (companyCheckError) {
      return NextResponse.json(
        { error: companyCheckError.message },
        { status: 500 }
      );
    }

    if (existingCompany) {
      return NextResponse.json(
        { error: "このメールアドレスは既に会社登録されています。" },
        { status: 400 }
      );
    }

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          company_name: companyName,
          role: "tenant_company",
        },
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message ?? "ログインアカウント作成に失敗しました。" },
        { status: 500 }
      );
    }

    const userId = authData.user.id;

    const { data: companyData, error: companyInsertError } = await supabaseAdmin
      .from("companies")
      .insert({
        name: companyName,
        email,
        phone: phone || null,
        login_user_id: userId,
        is_active: true,
      })
      .select("id, name")
      .single();

    if (companyInsertError || !companyData) {
      await supabaseAdmin.auth.admin.deleteUser(userId);

      return NextResponse.json(
        { error: companyInsertError?.message ?? "会社登録に失敗しました。" },
        { status: 500 }
      );
    }

    const { error: profileInsertError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: userId,
        company_id: companyData.id,
        name: companyName,
        email,
        phone: phone || null,
        role: "tenant_company",
      });

    if (profileInsertError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      await supabaseAdmin.from("companies").delete().eq("id", companyData.id);

      return NextResponse.json(
        { error: profileInsertError.message },
        { status: 500 }
      );
    }

    const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://tenant-delivery-app.vercel.app"}/login`;

    if (resend) {
      await resend.emails.send({
        from: "onboarding@resend.dev",
        to: email,
        subject: "【到着荷物通知サービス】ログイン情報のご案内",
        html: `
          <div style="font-family:sans-serif; line-height:1.7;">
            <h2>到着荷物通知サービス 登録完了</h2>

            <p>${companyName} 様</p>

            <p>
              会社アカウントの初期登録が完了しました。
            </p>

            <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
              <tr>
                <td><b>会社名</b></td>
                <td>${companyName}</td>
              </tr>
              <tr>
                <td><b>ログインメール</b></td>
                <td>${email}</td>
              </tr>
              <tr>
                <td><b>ログインURL</b></td>
                <td><a href="${loginUrl}">${loginUrl}</a></td>
              </tr>
            </table>

            <p style="margin-top:24px;">
              登録時に設定したパスワードでログインしてください。
            </p>
          </div>
        `,
      });
    }

    return NextResponse.json({
      success: true,
      company_id: companyData.id,
      login_url: loginUrl,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "会社初期登録中にエラーが発生しました。" },
      { status: 500 }
    );
  }
}