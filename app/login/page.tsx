"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("ログイン失敗：" + error.message);
    } else {
      alert("ログイン成功！");
      router.push("/home"); // ←ここ追加
    }
  };

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-80 space-y-4">
        <h1 className="text-xl font-bold text-center">ログイン</h1>

        <input
          type="email"
          placeholder="メールアドレス"
          className="w-full border p-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="パスワード"
          className="w-full border p-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          onClick={handleLogin}
          className="w-full bg-black text-white p-2"
        >
          ログイン
        </button>
      </div>
    </div>
  );
}