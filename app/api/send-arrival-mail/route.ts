import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      to,
      groupEmail,
      companyName,
      staffName,
      department,
      carrierName,
      quantity,
      location,
    } = body;

    const targets = [
      to,
      groupEmail,
    ].filter(Boolean);

    if (targets.length === 0) {
      return NextResponse.json({
        success: false,
        error: "送信先メールがありません。",
      });
    }

    const subject = `【荷物到着通知】${staffName} 様宛の荷物が届いています`;

    const html = `
      <div style="font-family:sans-serif;">
        <h2>荷物到着通知</h2>

        <p>${staffName} 様</p>

        <p>
          荷物が到着しました。
        </p>

        <table border="1" cellpadding="8" cellspacing="0">
          <tr>
            <td><b>会社</b></td>
            <td>${companyName}</td>
          </tr>

          <tr>
            <td><b>部署</b></td>
            <td>${department}</td>
          </tr>

          <tr>
            <td><b>配送会社</b></td>
            <td>${carrierName}</td>
          </tr>

          <tr>
            <td><b>個数</b></td>
            <td>${quantity}</td>
          </tr>

          <tr>
            <td><b>保管場所</b></td>
            <td>${location}</td>
          </tr>
        </table>

        <p style="margin-top:24px;">
          荷物をご確認ください。
        </p>
      </div>
    `;

    const data = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: targets,
      subject,
      html,
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: "メール送信エラー",
      },
      {
        status: 500,
      }
    );
  }
}