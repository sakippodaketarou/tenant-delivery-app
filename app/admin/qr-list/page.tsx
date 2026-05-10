"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "react-qr-code";
import { supabase } from "@/lib/supabase/client";

type Company = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

type Staff = {
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
  companies: Company | null;
};

export default function AdminQrListPage() {
  const router = useRouter();

  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyFilter, setCompanyFilter] = useState("all");
  const [keyword, setKeyword] = useState("");

  const fetchStaffs = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("staffs")
      .select(`
        id,
        company_id,
        staff_name,
        signature,
        department,
        email,
        group_email,
        qr_value,
        is_active,
        created_at,
        companies (
          id,
          name,
          email,
          phone
        )
      `)
      .order("company_id")
      .order("department")
      .order("staff_name");

    if (error) {
      alert("スタッフ取得エラー：" + error.message);
      setLoading(false);
      return;
    }

    setStaffs((data ?? []) as unknown as Staff[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchStaffs();
  }, []);

  const companyOptions = useMemo(() => {
    const map = new Map<string, string>();

    staffs.forEach((staff) => {
      map.set(staff.company_id, staff.companies?.name ?? "会社名未設定");
    });

    return Array.from(map.entries()).map(([id, name]) => ({
      id,
      name,
    }));
  }, [staffs]);

  const filteredStaffs = useMemo(() => {
    const lowerKeyword = keyword.trim().toLowerCase();

    return staffs.filter((staff) => {
      if (companyFilter !== "all" && staff.company_id !== companyFilter) {
        return false;
      }

      if (!lowerKeyword) return true;

      const targetText = [
        staff.companies?.name,
        staff.staff_name,
        staff.signature,
        staff.department,
        staff.email,
        staff.group_email,
        staff.qr_value,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return targetText.includes(lowerKeyword);
    });
  }, [staffs, companyFilter, keyword]);

  const groupedByCompany = useMemo(() => {
    const map = new Map<string, Staff[]>();

    filteredStaffs.forEach((staff) => {
      const companyName = staff.companies?.name ?? "会社名未設定";

      if (!map.has(companyName)) {
        map.set(companyName, []);
      }

      map.get(companyName)!.push(staff);
    });

    return Array.from(map.entries());
  }, [filteredStaffs]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between rounded-2xl bg-white p-6 shadow print:hidden">
          <div>
            <h1 className="text-2xl font-bold">テナント / スタッフQR一覧</h1>
            <p className="text-sm text-gray-500">
              各会社が登録したスタッフQRを一覧で確認・印刷できます。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={fetchStaffs}
              className="rounded-lg border px-4 py-2"
            >
              更新
            </button>

            <button
              onClick={handlePrint}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white"
            >
              印刷
            </button>

            <button
              onClick={() => router.push("/home")}
              className="rounded-lg bg-black px-4 py-2 text-white"
            >
              管理画面へ戻る
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 print:hidden">
          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">表示スタッフ</p>
            <p className="mt-2 text-3xl font-bold">{filteredStaffs.length}</p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">登録会社数</p>
            <p className="mt-2 text-3xl font-bold">{companyOptions.length}</p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">有効スタッフ</p>
            <p className="mt-2 text-3xl font-bold">
              {filteredStaffs.filter((staff) => staff.is_active).length}
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow print:hidden">
          <h2 className="mb-4 text-xl font-bold">絞り込み</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-bold">会社</label>
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="w-full rounded-lg border p-3"
              >
                <option value="all">全社</option>

                {companyOptions.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold">検索</label>
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="会社名・スタッフ名・部署・QR値など"
                className="w-full rounded-lg border p-3"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow print:shadow-none">
          <h2 className="mb-4 text-xl font-bold">QR一覧</h2>

          {loading ? (
            <p>読み込み中...</p>
          ) : filteredStaffs.length === 0 ? (
            <p className="text-gray-500">
              表示できるスタッフがありません。
            </p>
          ) : (
            <div className="space-y-10">
              {groupedByCompany.map(([companyName, companyStaffs]) => {
                const departments = companyStaffs.reduce<
                  Record<string, Staff[]>
                >((acc, staff) => {
                  const department = staff.department || "未分類";

                  if (!acc[department]) {
                    acc[department] = [];
                  }

                  acc[department].push(staff);
                  return acc;
                }, {});

                const company = companyStaffs[0]?.companies;

                return (
                  <section key={companyName} className="space-y-5">
                    <div className="border-b pb-3">
                      <h3 className="text-2xl font-bold">{companyName}</h3>
                      <p className="text-sm text-gray-500">
                        会社メール：{company?.email ?? "-"} / TEL：
                        {company?.phone ?? "-"}
                      </p>
                    </div>

                    {Object.entries(departments).map(
                      ([department, departmentStaffs]) => (
                        <div key={department} className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-lg font-bold">
                              {department}
                            </h4>
                            <p className="text-sm text-gray-500">
                              {departmentStaffs.length}名
                            </p>
                          </div>

                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 print:grid-cols-2">
                            {departmentStaffs.map((staff) => (
                              <div
                                key={staff.id}
                                className={`rounded-2xl border bg-white p-5 shadow-sm print:break-inside-avoid ${
                                  staff.is_active ? "" : "opacity-50"
                                }`}
                              >
                                <div className="flex gap-4">
                                  <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-xl border bg-white p-2">
                                    {staff.qr_value ? (
                                      <QRCode
                                        value={staff.qr_value}
                                        size={112}
                                        level="M"
                                      />
                                    ) : (
                                      <span className="text-xs text-gray-400">
                                        QRなし
                                      </span>
                                    )}
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <p className="text-lg font-bold">
                                          {staff.staff_name}
                                        </p>

                                        <p className="mt-1 text-sm text-gray-500">
                                          署名：{staff.signature ?? "-"}
                                        </p>
                                      </div>

                                      <span
                                        className={`rounded-full px-2 py-1 text-xs font-bold print:hidden ${
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
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}