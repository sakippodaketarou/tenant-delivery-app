"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/lib/supabase/client";

type Staff = {
  id: string;
  name: string;
  department: string | null;
  phone: string | null;
  email: string;
  role: string;
  qr_value: string | null;
};

export default function StaffPage() {
  const router = useRouter();
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStaff = async () => {
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: myProfile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!myProfile?.company_id) {
      alert("会社情報が見つかりません。");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, department, phone, email, role, qr_value")
      .eq("company_id", myProfile.company_id)
      .order("department")
      .order("name");

    if (error) {
      alert("スタッフ取得エラー：" + error.message);
      setLoading(false);
      return;
    }

    setStaffList((data ?? []) as Staff[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const groupedStaff = useMemo(() => {
    return staffList.reduce<Record<string, Staff[]>>((acc, staff) => {
      const dept = staff.department || "未分類";
      if (!acc[dept]) acc[dept] = [];
      acc[dept].push(staff);
      return acc;
    }, {});
  }, [staffList]);

  return (
    <main className="min-h-screen bg-gray-100 p-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between rounded-2xl bg-white p-6 shadow print:hidden">
          <div>
            <h1 className="text-2xl font-bold">スタッフ管理</h1>
            <p className="text-sm text-gray-500">
              部署ごとにスタッフQRを確認・印刷できます。
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => router.push("/staff/add")}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white"
            >
              スタッフ追加
            </button>

            <button
              onClick={() => window.print()}
              className="rounded-lg bg-gray-800 px-4 py-2 text-white"
            >
              印刷
            </button>

            <button
              onClick={() => router.push("/home")}
              className="rounded-lg bg-black px-4 py-2 text-white"
            >
              ホームへ戻る
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl bg-white p-6 shadow">読み込み中...</div>
        ) : staffList.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-gray-500 shadow">
            スタッフが登録されていません。
          </div>
        ) : (
          Object.entries(groupedStaff).map(([department, staffs]) => (
            <section
              key={department}
              className="break-after-page rounded-2xl bg-white p-6 shadow print:rounded-none print:shadow-none"
            >
              <div className="mb-6 border-b pb-4">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">📁</div>
                  <div>
                    <h2 className="text-2xl font-bold">{department}</h2>
                    <p className="text-sm text-gray-500">
                      {staffs.length}名のスタッフ
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 print:grid-cols-2">
                {staffs.map((staff) => (
                  <div
                    key={staff.id}
                    className="flex items-center gap-5 rounded-xl border p-5"
                  >
                    <div className="rounded-lg bg-white p-2">
                      <QRCodeSVG
                        value={staff.qr_value ?? staff.id}
                        size={110}
                      />
                    </div>

                    <div className="min-w-0">
                      <p className="text-xl font-bold">{staff.name}</p>
                      <p className="text-sm text-gray-600">
                        部署：{staff.department ?? "-"}
                      </p>
                      <p className="text-sm text-gray-600">
                        メール：{staff.email}
                      </p>
                      <p className="text-sm text-gray-600">
                        電話番号：{staff.phone ?? "-"}
                      </p>
                      <p className="text-sm text-gray-600">
                        権限：{staff.role}
                      </p>
                      <p className="mt-2 break-all text-xs text-gray-500">
                        QR値：{staff.qr_value ?? staff.id}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </main>
  );
}