"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type MyProfile = {
  id: string;
  company_id: string;
  name: string;
  department: string | null;
  role: string | null;
};

type StaffRow = {
  id: string;
  company_id: string;
  department: string | null;
};

export default function TenantStaffAddPage() {
  const router = useRouter();

  const [myProfile, setMyProfile] = useState<MyProfile | null>(null);
  const [staffList, setStaffList] = useState<StaffRow[]>([]);

  const [name, setName] = useState("");
  const [signature, setSignature] = useState("");
  const [department, setDepartment] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("tenant_staff");

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const fetchInitialData = async () => {
    setInitialLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, company_id, name, department, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profileData) {
      alert("ログインユーザー情報の取得に失敗しました。");
      setInitialLoading(false);
      return;
    }

    setMyProfile(profileData as MyProfile);

    const { data: staffData } = await supabase
      .from("profiles")
      .select("id, company_id, department")
      .eq("company_id", profileData.company_id)
      .order("department");

    setStaffList((staffData ?? []) as StaffRow[]);
    setInitialLoading(false);
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const departmentOptions = useMemo(() => {
    const values = staffList
      .map((staff) => staff.department)
      .filter((value): value is string => Boolean(value));

    return Array.from(new Set(values));
  }, [staffList]);

  const handleSubmit = async () => {
    if (!myProfile) {
      alert("ログイン情報が取得できていません。");
      return;
    }

    if (!name.trim()) {
      alert("名前を入力してください。");
      return;
    }

    if (!signature.trim()) {
      alert("署名を入力してください。");
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

    setLoading(true);

    const res = await fetch("/api/staff/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        company_id: myProfile.company_id,
        name: name.trim(),
        signature: signature.trim(),
        department: department.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        password,
        role,
      }),
    });

    const result = await res.json();

    setLoading(false);

    if (!res.ok) {
      alert("スタッフ作成エラー：" + (result.error ?? "不明なエラー"));
      return;
    }

    alert(`スタッフを追加しました。\nQR値：${result.qr_value ?? "作成済み"}`);
    router.push("/tenant/staff");
  };

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between rounded-2xl bg-white p-6 shadow">
          <div>
            <h1 className="text-2xl font-bold">テナントスタッフ追加</h1>
            <p className="text-sm text-gray-500">
              自社スタッフのログインアカウントとQRコードを作成します。
            </p>
          </div>

          <button
            onClick={() => router.push("/tenant/staff")}
            className="rounded-lg bg-black px-4 py-2 text-white"
          >
            戻る
          </button>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          {initialLoading ? (
            <p>読み込み中...</p>
          ) : (
            <div className="space-y-5">
              <div>
                <label className="mb-1 block text-sm font-bold">名前</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例：山田 太郎"
                  className="w-full rounded-lg border p-3"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold">署名</label>
                <input
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder="例：山田"
                  className="w-full rounded-lg border p-3"
                />
                <p className="mt-1 text-xs text-gray-500">
                  QR値生成にも使います。短い名前や識別名がおすすめです。
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold">部署</label>
                <input
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="例：管理部"
                  list="tenant-department-options"
                  className="w-full rounded-lg border p-3"
                />

                <datalist id="tenant-department-options">
                  {departmentOptions.map((department) => (
                    <option key={department} value={department} />
                  ))}
                </datalist>

                <p className="mt-1 text-xs text-gray-500">
                  既存部署は候補に表示されます。新しい部署名も入力できます。
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold">
                  メールアドレス
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@example.com"
                  className="w-full rounded-lg border p-3"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold">電話番号</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="090-0000-0000"
                  className="w-full rounded-lg border p-3"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold">
                  初期パスワード
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="6文字以上"
                  className="w-full rounded-lg border p-3"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold">権限</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-lg border p-3"
                >
                  <option value="tenant_staff">一般スタッフ</option>
                  <option value="tenant_admin">テナント管理者</option>
                </select>
              </div>

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full rounded-lg bg-blue-600 py-3 font-bold text-white disabled:bg-gray-400"
              >
                {loading ? "作成中..." : "スタッフを追加する"}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}