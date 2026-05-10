"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TenantRegisterPage() {
  const router = useRouter();

  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [loginUrl, setLoginUrl] = useState("");

  const handleSubmit = async () => {
    if (!companyName.trim()) {
      alert("会社名を入力してください。");
      return;
    }

    if (!email.trim()) {
      alert("メールアドレスを入力してください。");
      return;
    }

    if (!password || password.length < 6) {
      alert("パスワードは6文字以上で入力してください。");
      return;
    }

    if (password !== passwordConfirm) {
      alert("確認用パスワードが一致しません。");
      return;
    }

    setLoading(true);

    const response = await fetch("/api/tenant/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        companyName: companyName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
      }),
    });

    const result = await response.json();

    setLoading(false);

    if (!response.ok) {
      alert(result.error ?? "登録に失敗しました。");
      return;
    }

    setLoginUrl(result.login_url ?? "/login");
    setCompleted(true);
  };

  if (completed) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">
        <div className="mx-auto flex min-h-screen max-w-2xl items-center">
          <div className="w-full rounded-3xl border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
            <div className="mb-6 inline-flex rounded-full bg-green-500/20 px-4 py-2 text-sm font-bold text-green-300">
              登録完了
            </div>

            <h1 className="text-3xl font-bold">
              会社アカウントの登録が完了しました
            </h1>

            <p className="mt-4 text-slate-300">
              設定したメールアドレス宛にログインURLを送信しました。
              登録時に設定したパスワードでログインしてください。
            </p>

            <div className="mt-6 rounded-2xl bg-black/30 p-5">
              <p className="text-sm text-slate-400">ログインURL</p>
              <p className="mt-2 break-all font-bold text-blue-300">
                {loginUrl}
              </p>
            </div>

            <button
              onClick={() => router.push("/login")}
              className="mt-8 w-full rounded-xl bg-blue-600 py-3 font-bold text-white transition hover:bg-blue-700"
            >
              ログイン画面へ
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-8 lg:grid-cols-[1fr_460px]">
        <div>
          <div className="mb-6 inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-300">
            Tenant Delivery System
          </div>

          <h1 className="text-4xl font-bold leading-tight md:text-5xl">
            到着荷物通知サービス
            <br />
            会社アカウント初期登録
          </h1>

          <p className="mt-6 max-w-xl text-slate-300">
            会社単位の共通ログインアカウントを作成します。
            スタッフ個別のログイン作成は不要で、登録後にスタッフCSV取込・QR運用ができます。
          </p>

          <div className="mt-8 grid max-w-xl gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-lg font-bold">01</p>
              <p className="mt-2 text-sm text-slate-300">会社情報登録</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-lg font-bold">02</p>
              <p className="mt-2 text-sm text-slate-300">ログインURL送信</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-lg font-bold">03</p>
              <p className="mt-2 text-sm text-slate-300">スタッフCSV取込</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur">
          <h2 className="text-2xl font-bold">初期登録</h2>
          <p className="mt-1 text-sm text-slate-300">
            登録完了後、ログインURLをメールで送信します。
          </p>

          <div className="mt-6 space-y-5">
            <div>
              <label className="mb-1 block text-sm font-bold">会社名</label>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="例：株式会社サンプル"
                className="w-full rounded-xl border border-white/10 bg-white/90 p-3 text-black outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold">
                ログイン用メールアドレス
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="company@example.com"
                className="w-full rounded-xl border border-white/10 bg-white/90 p-3 text-black outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold">電話番号</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="092-000-0000"
                className="w-full rounded-xl border border-white/10 bg-white/90 p-3 text-black outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold">
                パスワード
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6文字以上"
                className="w-full rounded-xl border border-white/10 bg-white/90 p-3 text-black outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold">
                パスワード確認
              </label>
              <input
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="確認のため再入力"
                className="w-full rounded-xl border border-white/10 bg-white/90 p-3 text-black outline-none"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white transition hover:bg-blue-700 disabled:bg-gray-500"
            >
              {loading ? "登録中..." : "会社アカウントを登録する"}
            </button>

            <button
              onClick={() => router.push("/login")}
              className="w-full rounded-xl border border-white/20 py-3 font-bold text-white transition hover:bg-white/10"
            >
              すでに登録済みの方はこちら
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}