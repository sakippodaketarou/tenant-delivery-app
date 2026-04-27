"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type PackageRow = {
  id: string;
  quantity: number;
  status: string;
  arrived_at: string;
  received_at: string | null;
  companies: { name: string } | null;
  carriers: { name: string } | null;
  locations: { code: string; name: string | null } | null;
  profiles: { name: string; department: string | null; email: string } | null;
};

export default function AdminPackagesPage() {
  const router = useRouter();
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPackages = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("packages")
      .select(`
        id,
        quantity,
        status,
        arrived_at,
        received_at,
        companies ( name ),
        carriers ( name ),
        locations ( code, name ),
        profiles:recipient_user_id ( name, department, email )
      `)
      .order("arrived_at", { ascending: false });

    if (error) {
      alert("全社到着状況取得エラー：" + error.message);
      setLoading(false);
      return;
    }

    setPackages((data ?? []) as unknown as PackageRow[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between rounded-2xl bg-white p-6 shadow">
          <div>
            <h1 className="text-2xl font-bold">全社到着状況一覧</h1>
            <p className="text-sm text-gray-500">
              全テナント宛の荷物到着状況を確認できます。
            </p>
          </div>

          <button
            onClick={() => router.push("/home")}
            className="rounded-lg bg-black px-4 py-2 text-white"
          >
            ホームへ戻る
          </button>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          {loading ? (
            <p>読み込み中...</p>
          ) : packages.length === 0 ? (
            <p className="text-gray-500">到着荷物はありません。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="p-3">テナント</th>
                    <th className="p-3">宛先スタッフ</th>
                    <th className="p-3">配送業者</th>
                    <th className="p-3">個数</th>
                    <th className="p-3">ロケーション</th>
                    <th className="p-3">到着日時</th>
                    <th className="p-3">状況</th>
                  </tr>
                </thead>

                <tbody>
                  {packages.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="p-3 font-bold">
                        {item.companies?.name ?? "-"}
                      </td>
                      <td className="p-3">
                        {item.profiles?.name ?? "-"}
                        {item.profiles?.department && (
                          <span className="ml-2 text-xs text-gray-500">
                            {item.profiles.department}
                          </span>
                        )}
                      </td>
                      <td className="p-3">{item.carriers?.name ?? "-"}</td>
                      <td className="p-3">{item.quantity}</td>
                      <td className="p-3">
                        {item.locations?.code ?? "-"}
                        {item.locations?.name && (
                          <span className="ml-2 text-xs text-gray-500">
                            {item.locations.name}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {new Date(item.arrived_at).toLocaleString("ja-JP")}
                      </td>
                      <td className="p-3">
                        {item.status === "received" ? "受取済み" : "未受取"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
