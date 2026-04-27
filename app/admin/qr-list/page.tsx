"use client";

import { useEffect, useState } from "react";
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

type Company = {
  id: string;
  name: string;
  phone: string | null;
  qr_value: string | null;
  profiles: Staff[];
};

export default function QrListPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCompanies = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("companies")
      .select(`
        id,
        name,
        phone,
        qr_value,
        profiles (
          id,
          name,
          department,
          phone,
          email,
          role,
          qr_value
        )
      `)
      .order("name", { ascending: true });

    if (error) {
      alert("QR一覧取得エラー：" + error.message);
      setLoading(false);
      return;
    }

    setCompanies((data ?? []) as Company[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  if (selectedCompany) {
    return (
      <main className="min-h-screen bg-gray-100 p-6 print:bg-white print:p-0">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex items-center justify-between rounded-2xl bg-white p-6 shadow print:hidden">
            <div>
              <button
                onClick={() => setSelectedCompany(null)}
                className="mb-3 rounded-lg border px-4 py-2"
              >
                ← 会社一覧に戻る
              </button>

              <h1 className="text-2xl font-bold">
                {selectedCompany.name} スタッフQR一覧
              </h1>
              <p className="text-sm text-gray-500">
                この会社に所属するスタッフのQRコード一覧です。
              </p>
            </div>

            <button
              onClick={() => window.print()}
              className="rounded-lg bg-black px-5 py-2 text-white"
            >
              印刷する
            </button>
          </div>

          <section className="rounded-2xl bg-white p-8 shadow print:rounded-none print:shadow-none">
            <div className="mb-8 border-b pb-6">
              <p className="text-sm text-gray-500">テナント会社</p>
              <h2 className="text-3xl font-bold">{selectedCompany.name}</h2>
            </div>

            {selectedCompany.profiles.length === 0 ? (
              <p className="text-gray-500">スタッフが登録されていません。</p>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 print:grid-cols-2">
                {selectedCompany.profiles.map((staff) => (
                  <div
                    key={staff.id}
                    className="flex items-center gap-5 rounded-xl border p-5"
                  >
                    <QRCodeSVG value={staff.qr_value ?? staff.id} size={110} />

                    <div>
                      <p className="text-lg font-bold">{staff.name}</p>
                      <p className="text-sm text-gray-600">
                        部署：{staff.department ?? "-"}
                      </p>
                      <p className="text-sm text-gray-600">
                        TEL：{staff.phone ?? "-"}
                      </p>
                      <p className="text-sm text-gray-600">
                        Email：{staff.email}
                      </p>
                      <p className="mt-2 text-xs text-gray-500">
                        QR値：{staff.qr_value}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between rounded-2xl bg-white p-6 shadow print:hidden">
          <div>
            <h1 className="text-2xl font-bold">テナント会社QR一覧</h1>
            <p className="text-sm text-gray-500">
              会社カードをクリックすると、スタッフQR一覧を表示します。
            </p>
          </div>

          <button
            onClick={() => window.print()}
            className="rounded-lg bg-black px-5 py-2 text-white"
          >
            会社一覧を印刷
          </button>
        </div>

        {loading ? (
          <p>読み込み中...</p>
        ) : companies.length === 0 ? (
          <p>会社データがありません。</p>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 print:grid-cols-2">
            {companies.map((company) => (
              <button
                key={company.id}
                onClick={() => setSelectedCompany(company)}
                className="rounded-2xl bg-white p-6 text-left shadow transition hover:scale-[1.01] hover:shadow-lg print:hover:scale-100"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-gray-500">テナント会社</p>
                    <h2 className="text-2xl font-bold">{company.name}</h2>
                    <p className="mt-2 text-xs text-gray-500">
                      QR値：{company.qr_value}
                    </p>
                  </div>

                  <QRCodeSVG
                    value={company.qr_value ?? company.id}
                    size={110}
                  />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}