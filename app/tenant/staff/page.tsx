"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "react-qr-code";
import { supabase } from "@/lib/supabase/client";

type MyProfile = {
  id: string;
  company_id: string;
  name: string;
};

type StaffRow = {
  id: string;
  company_id: string;
  staff_name: string;
  signature: string | null;
  department: string | null;
  email: string | null;
  group_email: string | null;
  qr_value: string | null;
  is_active: boolean;
  created_at: string;
};

type CsvStaff = {
  department: string;
  staff_name: string;
  signature: string;
  email: string;
  group_email: string;
};

export default function TenantStaffPage() {
  const router = useRouter();

  const [myProfile, setMyProfile] = useState<MyProfile | null>(null);
  const [staffList, setStaffList] = useState<StaffRow[]>([]);
  const [csvStaffs, setCsvStaffs] = useState<CsvStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

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
      .select("id, company_id, name")
      .eq("id", user.id)
      .single();

    if (profileError || !profileData) {
      alert("ログイン情報の取得に失敗しました。");
      setLoading(false);
      return;
    }

    setMyProfile(profileData as MyProfile);

    const { data: staffData, error: staffError } = await supabase
      .from("staffs")
      .select(
        "id, company_id, staff_name, signature, department, email, group_email, qr_value, is_active, created_at"
      )
      .eq("company_id", profileData.company_id)
      .order("department")
      .order("staff_name");

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

  const createQrValue = (signature: string) => {
    const safeSignature = signature
      .replace(/\s/g, "")
      .replace(/[^\w\u3040-\u30ff\u3400-\u9fff]/g, "")
      .toUpperCase();

    const random = Math.random().toString(36).slice(2, 8).toUpperCase();

    return `STAFF_${safeSignature}_${random}`;
  };

  const parseCsvLine = (line: string) => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result.map((value) => value.replace(/^"|"$/g, ""));
  };

  const handleCsvChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const text = await file.text();

    const lines = text
      .replace(/\r/g, "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length <= 1) {
      alert("CSVにデータがありません。");
      return;
    }

    const rows = lines.slice(1).map(parseCsvLine);

    const parsed = rows
      .map((cols) => ({
        department: cols[0] ?? "",
        staff_name: cols[1] ?? "",
        signature: cols[2] ?? "",
        email: cols[3] ?? "",
        group_email: cols[4] ?? "",
      }))
      .filter((row) => row.department && row.staff_name && row.signature);

    if (parsed.length === 0) {
      alert("取込可能なデータがありません。部署・スタッフ名・署名は必須です。");
      return;
    }

    setCsvStaffs(parsed);
  };

  const handleImportCsv = async () => {
    if (!myProfile) {
      alert("ログイン情報が取得できていません。");
      return;
    }

    if (csvStaffs.length === 0) {
      alert("CSVデータがありません。");
      return;
    }

    const ok = confirm(`${csvStaffs.length}名のスタッフを一括登録しますか？`);

    if (!ok) return;

    setImporting(true);

    const insertRows = csvStaffs.map((staff) => ({
      company_id: myProfile.company_id,
      department: staff.department,
      staff_name: staff.staff_name,
      signature: staff.signature,
      email: staff.email || null,
      group_email: staff.group_email || null,
      qr_value: createQrValue(staff.signature),
      is_active: true,
    }));

    const { error } = await supabase.from("staffs").insert(insertRows);

    setImporting(false);

    if (error) {
      alert("CSV取込エラー：" + error.message);
      return;
    }

    alert("CSV取込が完了しました。");
    setCsvStaffs([]);
    await fetchStaff();
  };

  const downloadSampleCsv = () => {
    const csv =
      "部署,スタッフ名,署名,本人メール,共有メール\n" +
      "管理部,山田太郎,YAMADA,yamada@example.com,kanri@example.com\n" +
      "営業部,佐藤花子,SATO,sato@example.com,eigyo@example.com\n";

    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "staff_import_sample.csv";
    a.click();

    URL.revokeObjectURL(url);
  };

  const handleDelete = async (staff: StaffRow) => {
    const ok = confirm(
      `${staff.staff_name} さんを削除しますか？\nこの操作は取り消せません。`
    );

    if (!ok) return;

    const { error } = await supabase.from("staffs").delete().eq("id", staff.id);

    if (error) {
      alert("削除エラー：" + error.message);
      return;
    }

    alert("スタッフを削除しました。");
    await fetchStaff();
  };

  const handleToggleActive = async (staff: StaffRow) => {
    const { error } = await supabase
      .from("staffs")
      .update({
        is_active: !staff.is_active,
      })
      .eq("id", staff.id);

    if (error) {
      alert("状態変更エラー：" + error.message);
      return;
    }

    await fetchStaff();
  };

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between rounded-2xl bg-white p-6 shadow">
          <div>
            <h1 className="text-2xl font-bold">スタッフ管理</h1>
            <p className="text-sm text-gray-500">
              スタッフはログイン不要です。荷物の宛先・通知先として管理します。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => router.push("/tenant/staff/add")}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white"
            >
              スタッフ追加
            </button>

            <button
              onClick={downloadSampleCsv}
              className="rounded-lg bg-green-600 px-4 py-2 text-white"
            >
              CSVサンプルDL
            </button>

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

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">登録スタッフ</p>
            <p className="mt-2 text-3xl font-bold">{staffList.length}</p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">有効</p>
            <p className="mt-2 text-3xl font-bold">
              {staffList.filter((staff) => staff.is_active).length}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">無効</p>
            <p className="mt-2 text-3xl font-bold">
              {staffList.filter((staff) => !staff.is_active).length}
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-bold">CSV一括取込</h2>
              <p className="text-sm text-gray-500">
                形式：部署,スタッフ名,署名,本人メール,共有メール
              </p>
            </div>

            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleCsvChange}
              className="rounded-lg border bg-white p-2"
            />
          </div>

          {csvStaffs.length > 0 && (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left">
                      <th className="p-3">部署</th>
                      <th className="p-3">スタッフ名</th>
                      <th className="p-3">署名</th>
                      <th className="p-3">本人メール</th>
                      <th className="p-3">共有メール</th>
                    </tr>
                  </thead>

                  <tbody>
                    {csvStaffs.map((staff, index) => (
                      <tr key={`${staff.staff_name}-${index}`} className="border-b">
                        <td className="p-3">{staff.department}</td>
                        <td className="p-3">{staff.staff_name}</td>
                        <td className="p-3">{staff.signature}</td>
                        <td className="p-3">{staff.email || "-"}</td>
                        <td className="p-3">{staff.group_email || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={handleImportCsv}
                disabled={importing}
                className="rounded-lg bg-blue-600 px-5 py-3 font-bold text-white disabled:bg-gray-400"
              >
                {importing ? "取込中..." : `${csvStaffs.length}名を一括登録`}
              </button>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-bold">スタッフ一覧</h2>

          {loading ? (
            <p>読み込み中...</p>
          ) : staffList.length === 0 ? (
            <p className="text-gray-500">スタッフが登録されていません。</p>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedByDepartment).map(([department, staffs]) => (
                <div key={department} className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="text-lg font-bold">{department}</h3>
                    <p className="text-sm text-gray-500">{staffs.length}名</p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {staffs.map((staff) => (
                      <div
                        key={staff.id}
                        className={`rounded-2xl border bg-white p-5 shadow-sm ${
                          staff.is_active ? "" : "opacity-50"
                        }`}
                      >
                        <div className="flex gap-4">
                          <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-xl border bg-white p-2">
                            {staff.qr_value ? (
                              <QRCode value={staff.qr_value} size={96} level="M" />
                            ) : (
                              <span className="text-xs text-gray-400">QRなし</span>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-lg font-bold">{staff.staff_name}</p>
                                <p className="mt-1 text-sm text-gray-500">
                                  署名：{staff.signature ?? "-"}
                                </p>
                              </div>

                              <span
                                className={`rounded-full px-2 py-1 text-xs font-bold ${
                                  staff.is_active
                                    ? "bg-green-100 text-green-700"
                                    : "bg-gray-200 text-gray-600"
                                }`}
                              >
                                {staff.is_active ? "有効" : "無効"}
                              </span>
                            </div>

                            <p className="mt-2 text-sm text-gray-500">
                              部署：{staff.department ?? "-"}
                            </p>

                            <p className="truncate text-sm text-gray-500">
                              本人Mail：{staff.email ?? "-"}
                            </p>

                            <p className="truncate text-sm text-gray-500">
                              共有Mail：{staff.group_email ?? "-"}
                            </p>

                            <p className="mt-2 break-all text-xs text-gray-400">
                              QR値：{staff.qr_value ?? "-"}
                            </p>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                onClick={() => handleToggleActive(staff)}
                                className="rounded bg-gray-700 px-3 py-1 text-sm text-white"
                              >
                                {staff.is_active ? "無効化" : "有効化"}
                              </button>

                              <button
                                onClick={() => handleDelete(staff)}
                                className="rounded bg-red-600 px-3 py-1 text-sm text-white"
                              >
                                削除
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}