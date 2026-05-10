"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type MyProfile = {
  id: string;
  company_id: string;
  name: string;
};

type StaffRow = {
  id: string;
  department: string | null;
};

export default function TenantStaffAddPage() {
  const router = useRouter();

  const [myProfile, setMyProfile] = useState<MyProfile | null>(null);
  const [staffList, setStaffList] = useState<StaffRow[]>([]);

  const [staffName, setStaffName] = useState("");
  const [signature, setSignature] = useState("");
  const [department, setDepartment] = useState("");
  const [email, setEmail] = useState("");
  const [groupEmail, setGroupEmail] = useState("");

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
      .select("id, company_id, name")
      .eq("id", user.id)
      .single();

    if (profileError || !profileData) {
      alert("ログイン情報の取得に失敗しました。");
      setInitialLoading(false);
      return;
    }

    setMyProfile(profileData as MyProfile);

    const { data: staffData } = await supabase
      .from("staffs")
      .select("id, department")
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

  const createQrValue = () => {
    const safeSignature = signature
      .replace(/\s/g, "")
      .replace(/[^\w\u3040-\u30ff\u3400-\u9fff]/g, "")
      .toUpperCase();

    const random = Math.random().toString(36).slice(2, 8).toUpperCase();

    return `STAFF_${safeSignature}_${random}`;
  };

  const handleSubmit = async () => {
    if (!myProfile) {
      alert("ログイン情報が取得できていません。");
      return;
    }

    if (!staffName.trim()) {
      alert("スタッフ名を入力してください。");
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

    setLoading(true);

    const qrValue = createQrValue();

    const { error } = await supabase.from("staffs").insert({
      company_id: myProfile.company_id,
      staff_name: staffName.trim(),
      signature: signature.trim(),
      department: department.trim(),
      email: email.trim() || null,
      group_email: groupEmail.trim() || null,
      qr_value: qrValue,
      is_active: true,
    });

    setLoading(false);

    if (error) {
      alert("スタッフ登録エラー：" + error.message);
      return;
    }

    alert(`スタッフを追加しました。\nQR値：${qrValue}`);
    router.push("/tenant/staff");
  };

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between rounded-2xl bg-white p-6 shadow">
          <div>
            <h1 className="text-2xl font-bold">スタッフ追加</h1>
            <p className="text-sm text-gray-500">
              スタッフはログイン不要です。荷物の宛先・通知先として登録します。
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
                <label className="mb-1 block text-sm font-bold">
                  スタッフ名
                </label>
                <input
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  placeholder="例：山田 太郎"
                  className="w-full rounded-lg border p-3"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold">署名</label>
                <input
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder="例：YAMADA"
                  className="w-full rounded-lg border p-3"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold">部署</label>
                <input
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="例：管理部"
                  list="department-options"
                  className="w-full rounded-lg border p-3"
                />

                <datalist id="department-options">
                  {departmentOptions.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold">
                  本人メールアドレス
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="yamada@example.com"
                  className="w-full rounded-lg border p-3"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold">
                  部署共有メールアドレス
                </label>
                <input
                  type="email"
                  value={groupEmail}
                  onChange={(e) => setGroupEmail(e.target.value)}
                  placeholder="kanri@example.com"
                  className="w-full rounded-lg border p-3"
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full rounded-lg bg-blue-600 py-3 font-bold text-white disabled:bg-gray-400"
              >
                {loading ? "登録中..." : "スタッフを追加する"}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}