"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();

  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async () => {
    if (!companyName.trim()) {
      alert("テナント名を入力してください。");
      return;
    }

    if (!name.trim()) {
      alert("管理者名を入力してください。");
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

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (signUpError) {
      alert("ユーザー登録エラー：" + signUpError.message);
      return;
    }

    const user = signUpData.user;

    if (!user) {
      alert("ユーザー作成に失敗しました。");
      return;
    }

    const companyQrValue = `COMPANY_${Date.now()}`;

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .insert({
        name: companyName.trim(),
        phone: phone.trim() || null,
        qr_value: companyQrValue,
      })
      .select("id")
      .single();

    if (companyError) {
      alert("会社登録エラー：" + companyError.message);
      return;
    }

    const staffQrValue = `TENANT_ADMIN_${user.id.slice(0, 8).toUpperCase()}`;

    const { error: profileError } = await supabase.from("profiles").insert({
      id: user.id,
      company_id: company.id,
      name: name.trim(),
      department: department.trim() || "管理部",
      phone: phone.trim() || null,
      email: email.trim(),
      role: "tenant_admin",
      qr_value: staffQrValue,
    });

    if (profileError) {
      alert("プロフィール登録エラー：" + profileError.message);
      return;
    }

    alert("登録完了しました。ログインしてください。");
    router.push("/login");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
      <div className="w-full max-w-md space-y-5 rounded-2xl bg-white p-6 shadow">
        <div>
          <h1 className="text-2xl font-bold">新規テナント登録</h1>
          <p className="text-sm text-gray-500">
            テナント会社と管理者ユーザーを作成します。
          </p>
        </div>

        <input
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="テナント名 / 会社名"
          className="w-full rounded border p-3"
        />

        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="会社電話番号"
          className="w-full rounded border p-3"
        />

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="管理者名"
          className="w-full rounded border p-3"
        />

        <input
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          placeholder="部署 例：管理部"
          className="w-full rounded border p-3"
        />

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="メールアドレス"
          className="w-full rounded border p-3"
        />

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="パスワード 6文字以上"
          className="w-full rounded border p-3"
        />

        <button
          onClick={handleRegister}
          className="w-full rounded-lg bg-black py-3 text-white"
        >
          登録する
        </button>

        <button
          onClick={() => router.push("/login")}
          className="w-full rounded-lg border py-3"
        >
          ログインへ
        </button>
      </div>
    </main>
  );
}