"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function AddStaffPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) {
      alert("名前を入力してください。");
      return;
    }

    if (!department.trim()) {
      alert("部署を入力してください。");
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

    const { data: loginUserData } = await supabase.auth.getUser();
    const loginUser = loginUserData.user;

    if (!loginUser) {
      alert("ログインしてください。");
      router.push("/login");
      return;
    }

    const { data: myProfile, error: myProfileError } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", loginUser.id)
      .single();

    if (myProfileError || !myProfile?.company_id) {
      alert("ログイン中ユーザーの会社情報が見つかりません。");
      return;
    }

    const response = await fetch("/api/staff/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: name.trim(),
        department: department.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        companyId: myProfile.company_id,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert("スタッフ作成エラー：" + result.error);
      return;
    }

    alert("スタッフを追加しました。");
    router.push("/staff");
  };

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-xl space-y-6">
        <div className="rounded-2xl bg-white p-6 shadow">
          <h1 className="text-2xl font-bold">スタッフ追加</h1>
          <p className="text-sm text-gray-500">
            スタッフのログイン情報とQRコードを作成します。
          </p>
        </div>

        <div className="space-y-4 rounded-2xl bg-white p-6 shadow">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="名前"
            className="w-full rounded border p-3"
          />

          <input
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="部署"
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
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="電話番号"
            className="w-full rounded border p-3"
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="パスワード 6文字以上"
            className="w-full rounded border p-3"
          />

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleCreate}
              className="flex-1 rounded-lg bg-black py-3 text-white"
            >
              追加する
            </button>

            <button
              onClick={() => router.push("/staff")}
              className="flex-1 rounded-lg border py-3"
            >
              戻る
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}