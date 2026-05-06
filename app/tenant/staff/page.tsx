"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "react-qr-code";
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
  name: string;
  signature: string | null;
  department: string | null;
  phone: string | null;
  email: string | null;
  role: string | null;
  qr_value: string | null;
};

export default function TenantStaffPage() {
  const router = useRouter();

  const [myProfile, setMyProfile] = useState<MyProfile | null>(null);
  const [staffList, setStaffList] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStaff = async () => {
    setLoading(true);

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
      setLoading(false);
      return;
    }

    setMyProfile(profileData as MyProfile);

    const { data: staffData, error: staffError } = await supabase
      .from("profiles")
      .select(
        "id, company_id, name, signature, department, phone, email, role, qr_value"
      )
      .eq("company_id", profileData.company_id)
      .order("department")
      .order("name");

    if (staffError) {
      alert("スタッフ取得エラー：" + staffError.message);
      setLoading(false);
      return;
    }

    setStaffList((staffData ?? []) as StaffRow[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const groupedByDepartment = useMemo(() => {
    return staffList.reduce<Record<string, StaffRow[]>>((acc, staff) => {
      const department = staff.department || "未分類";

      if (!acc[department]) {
        acc[department] = [];
      }

      acc[department].push(staff);
      return acc;
    }, {});
  }, [staffList]);

  const canAddStaff =
    myProfile?.role === "tenant_admin" ||
    myProfile?.role === "admin" ||
    myProfile?.role === "tenant_staff";

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between rounded-2xl bg-white p-6 shadow">
          <div>
            <h1 className="text-2xl font-bold">テナントスタッフ管理</h1>
            <p className="text-sm text-gray-500">
              自社スタッフの確認・追加・QRコード印刷ができます。
            </p>
          </div>

          <div className="flex gap-3">
            {canAddStaff && (
              <button
                onClick={() => router.push("/tenant/staff/add")}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white"
              >
                スタッフ追加
              </button>
            )}

            <button
              onClick={() => window.print()}
              className="rounded-lg border px-4 py-2"
            >
              印刷
            </button>

            <button
              onClick={() => router.push("/tenant/home")}
              className="rounded-lg bg-black px-4 py-2 text-white"
            >
              テナント画面へ戻る
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-bold">スタッフ一覧</h2>

          {loading ? (
            <p>読み込み中...</p>
          ) : staffList.length === 0 ? (
            <p className="text-gray-500">スタッフが登録されていません。</p>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedByDepartment).map(
                ([department, staffs]) => (
                  <div key={department} className="space-y-4">
                    <div className="flex items-center justify-between border-b pb-2">
                      <h3 className="text-lg font-bold">{department}</h3>
                      <p className="text-sm text-gray-500">
                        {staffs.length}名
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {staffs.map((staff) => (
                        <div
                          key={staff.id}
                          className="rounded-2xl border bg-white p-5 shadow-sm"
                        >
                          <div className="flex gap-4">
                            <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-xl border bg-white p-2">
                              {staff.qr_value ? (
                                <QRCode
                                  value={staff.qr_value}
                                  size={96}
                                  level="M"
                                />
                              ) : (
                                <span className="text-xs text-gray-400">
                                  QRなし
                                </span>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="text-lg font-bold">{staff.name}</p>

                              <p className="mt-1 text-sm text-gray-500">
                                署名：{staff.signature ?? "-"}
                              </p>

                              <p className="text-sm text-gray-500">
                                部署：{staff.department ?? "-"}
                              </p>

                              <p className="text-sm text-gray-500">
                                権限：{staff.role ?? "-"}
                              </p>

                              <p className="text-sm text-gray-500">
                                TEL：{staff.phone ?? "-"}
                              </p>

                              <p className="truncate text-sm text-gray-500">
                                Mail：{staff.email ?? "-"}
                              </p>

                              <p className="mt-2 break-all text-xs text-gray-400">
                                QR値：{staff.qr_value ?? "-"}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}