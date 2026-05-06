"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");

  const handleRegister = async () => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      alert("Authエラー：" + error.message);
      return;
    }

    const user = data.user;

    if (!user) {
      alert("ユーザー作成に失敗しました。");
      return;
    }

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .insert({
        name: companyName,
      })
      .select()
      .single();

    if (companyError) {
      alert("会社登録エラー：" + companyError.message);
      return;
    }

    const { error: profileError } = await supabase.from("profiles").insert({
      id: user.id,
      company_id: company.id,
      name: "管理者",
      email,
      role: "tenant_admin",
    });

    if (profileError) {
      alert("プロフィール登録エラー：" + profileError.message);
      return;
    }

    alert("登録完了！");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-80 space-y-4 rounded-xl bg-white p-6 shadow">
        <h1 className="text-center text-xl font-bold">新規登録</h1>

        <input
          type="text"
          placeholder="テナント名 / 会社名"
          className="w-full rounded border p-2"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
        />

        <input
          type="email"
          placeholder="メールアドレス"
          className="w-full rounded border p-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="パスワード（6文字以上）"
          className="w-full rounded border p-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          onClick={handleRegister}
          className="w-full rounded bg-black p-2 text-white"
        >
          登録
        </button>
      </div>
    </div>
  );
}