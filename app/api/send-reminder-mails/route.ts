import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Supabase環境変数が不足しています。");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export async function POST() {
  try {
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    const { data: packages, error } = await supabaseAdmin
      .from("packages")
      .select(`
        id,
        company_id,
        quantity,
        arrived_at,
        reminder_sent_at,
        companies (
          name
        ),
        carriers (
          name
        ),
        staffs:recipient_staff_id (
          staff_name,
          department,
          email,
          group_email
        )
      `)
      .eq("status", "unreceived")
      .lte("arrived_at", fiveDaysAgo.toISOString())
      .is("reminder_sent_at", null);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    if (!packages || packages.length === 0) {
      return NextResponse.json({
        success: true,
        message: "送信対象はありません。",
        sentCount: 0,
      });
    }

    let sentCount = 0;
    const sentPackageIds: string[] = [];

    for (const item of packages as any[]) {
      const staff = item.staffs;
      const company = item.companies;
      const carrier = item.carriers;

      const targets = [staff?.email, staff?.group_email].filter(Boolean);

      if (targets.length === 0) {
        continue;
      }

      const arrivedAt = new Date(item.arrived_at);
      const elapsedDays = Math.floor(
        (Date.now() - arrivedAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      const subject = `【未受取アラート】${staff?.staff_name ?? "宛先未設定"} 様宛の荷物が${elapsedDays}日未受取です`;

      const html = `
        <div style="font-family:sans-serif; line-height:1.7;">
          <h2>未受取荷物アラート</h2>

          <p>
            以下の荷物が到着から <b>${elapsedDays}日</b> 経過しています。
          </p>

          <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
            <tr>
              <td><b>会社</b></td>
              <td>${company?.name ?? "-"}</td>
            </tr>
            <tr>
              <td><b>宛先スタッフ</b></td>
              <td>${staff?.staff_name ?? "-"}</td>
            </tr>
            <tr>
              <td><b>部署</b></td>
              <td>${staff?.department ?? "-"}</td>
            </tr>
            <tr>
              <td><b>配送会社</b></td>
              <td>${carrier?.name ?? "-"}</td>
            </tr>
            <tr>
              <td><b>個数</b></td>
              <td>${item.quantity}</td>
            </tr>
            <tr>
              <td><b>到着日時</b></td>
              <td>${arrivedAt.toLocaleString("ja-JP")}</td>
            </tr>
          </table>

          <p style="margin-top:24px;">
            お早めに荷物をご確認ください。
          </p>
        </div>
      `;

      await resend.emails.send({
        from: "onboarding@resend.dev",
        to: targets,
        subject,
        html,
      });

      sentCount += 1;
      sentPackageIds.push(item.id);
    }

    if (sentPackageIds.length > 0) {
      await supabaseAdmin
        .from("packages")
        .update({
          reminder_sent_at: new Date().toISOString(),
        })
        .in("id", sentPackageIds);
    }

    return NextResponse.json({
      success: true,
      sentCount,
      packageIds: sentPackageIds,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: "催促メール送信エラー",
      },
      { status: 500 }
    );
  }
}