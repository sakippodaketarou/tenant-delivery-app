"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Profile = {
  id: string;
  role: string | null;
  company_id: string | null;
  name: string | null;
};

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim()) {
      alert("メールアドレスを入力してください。");
      return;
    }

    if (!password) {
      alert("パスワードを入力してください。");
      return;
    }

    setLoading(true);

    const { data: loginData, error: loginError } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    if (loginError || !loginData.user) {
      setLoading(false);
      alert("ログインに失敗しました：" + (loginError?.message ?? ""));
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, company_id, name")
      .eq("id", loginData.user.id)
      .single();

    setLoading(false);

    if (profileError || !profileData) {
      alert("プロフィール情報が見つかりません。");
      return;
    }

    const profile = profileData as Profile;

    if (profile.role === "tenant_company") {
      router.push("/tenant/home");
      return;
    }

    if (profile.role === "tenant_staff") {
      router.push("/tenant/home");
      return;
    }

    router.push("/home");
  };

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-8 lg:grid-cols-[1fr_420px]">
        <div>
          <div className="mb-6 inline-flex rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-300">
            Tenant Delivery System
          </div>

          <h1 className="text-4xl font-bold leading-tight md:text-5xl">
            到着荷物通知サービス
            <br />
            管理ログイン
          </h1>

          <p className="mt-6 max-w-xl text-slate-300">
            荷捌き場で登録された荷物を、会社単位で確認・通知・受取管理できます。
            管理者は全社横断、テナントは自社分のみ確認できます。
          </p>

          <div className="mt-8 grid max-w-xl gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-lg font-bold">QR</p>
              <p className="mt-2 text-sm text-slate-300">荷物登録</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-lg font-bold">MAIL</p>
              <p className="mt-2 text-sm text-slate-300">到着通知</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-lg font-bold">ALERT</p>
              <p className="mt-2 text-sm text-slate-300">未受取管理</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur">
          <h2 className="text-2xl font-bold">ログイン</h2>
          <p className="mt-1 text-sm text-slate-300">
            登録済みのメールアドレスとパスワードを入力してください。
          </p>

          <div className="mt-6 space-y-5">
            <div>
              <label className="mb-1 block text-sm font-bold">
                メールアドレス
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
              <label className="mb-1 block text-sm font-bold">
                パスワード
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワード"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleLogin();
                  }
                }}
                className="w-full rounded-xl border border-white/10 bg-white/90 p-3 text-black outline-none"
              />
            </div>

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white transition hover:bg-blue-700 disabled:bg-gray-500"
            >
              {loading ? "ログイン中..." : "ログイン"}
            </button>

            <button
              onClick={() => router.push("/tenant/register")}
              className="w-full rounded-xl border border-white/20 py-3 font-bold text-white transition hover:bg-white/10"
            >
              会社アカウント初期登録はこちら
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}