"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type PackageRow = {
  id: string;
  quantity: number;
  status: string;
  arrived_at: string;
  carriers: { name: string } | null;
  locations: {
    id: string;
    code: string;
    name: string | null;
    map_x: number | null;
    map_y: number | null;
  } | null;
  profiles: { name: string; department: string | null } | null;
};

export default function HomePage() {
  const router = useRouter();
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocationCode, setSelectedLocationCode] = useState<string | null>(
    null
  );

  const fetchPackages = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("packages")
      .select(`
        id,
        quantity,
        status,
        arrived_at,
        carriers ( name ),
        locations (
          id,
          code,
          name,
          map_x,
          map_y
        ),
        profiles:recipient_user_id (
          name,
          department
        )
      `)
      .order("arrived_at", { ascending: false });

    if (error) {
      alert("荷物一覧取得エラー：" + error.message);
      setLoading(false);
      return;
    }

    setPackages((data ?? []) as unknown as PackageRow[]);
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleReceive = async (packageId: string) => {
    const { error } = await supabase
      .from("packages")
      .update({
        status: "received",
        received_at: new Date().toISOString(),
      })
      .eq("id", packageId);

    if (error) {
      alert("受取処理エラー：" + error.message);
      return;
    }

    fetchPackages();
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  const unreceivedPackages = packages.filter((p) => p.status === "unreceived");
  const receivedPackages = packages.filter((p) => p.status === "received");

  const locationSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        code: string;
        name: string | null;
        map_x: number;
        map_y: number;
        totalQuantity: number;
        packageCount: number;
      }
    >();

    unreceivedPackages.forEach((item) => {
      if (!item.locations?.code) return;

      const code = item.locations.code;
      const current = map.get(code);

      if (current) {
        current.totalQuantity += item.quantity;
        current.packageCount += 1;
      } else {
        map.set(code, {
          code,
          name: item.locations.name,
          map_x: item.locations.map_x ?? 0,
          map_y: item.locations.map_y ?? 0,
          totalQuantity: item.quantity,
          packageCount: 1,
        });
      }
    });

    return Array.from(map.values());
  }, [unreceivedPackages]);

  const selectedLocationPackages = selectedLocationCode
    ? unreceivedPackages.filter(
        (item) => item.locations?.code === selectedLocationCode
      )
    : [];

  const menuItems = [
    {
      title: "荷物スキャン登録",
      description: "配送会社・宛先・ロケーションQRを読み取ります",
      href: "/admin/register-package",
    },
    {
      title: "テナント / スタッフQR一覧",
      description: "会社QR・スタッフQRを表示、印刷します",
      href: "/admin/qr-list",
    },
    {
      title: "全社到着状況一覧",
      description: "全テナントの到着荷物を確認します",
      href: "/admin/packages",
    },
    {
      title: "スタッフ管理",
      description: "テナントスタッフを確認します",
      href: "/staff",
    },
  ];

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between rounded-2xl bg-white p-6 shadow">
          <div>
            <h1 className="text-2xl font-bold">到着荷物通知サービス</h1>
            <p className="text-sm text-gray-500">
              荷物到着状況の確認・登録・QR管理を行います
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-lg bg-black px-4 py-2 text-white"
          >
            ログアウト
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">未受取</p>
            <p className="mt-2 text-3xl font-bold">
              {unreceivedPackages.length}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">受取済み</p>
            <p className="mt-2 text-3xl font-bold">
              {receivedPackages.length}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">合計</p>
            <p className="mt-2 text-3xl font-bold">{packages.length}</p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-bold">メニュー</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {menuItems.map((item) => (
              <button
                key={item.title}
                onClick={() => router.push(item.href)}
                className="rounded-2xl border bg-white p-5 text-left transition hover:scale-[1.01] hover:shadow-md"
              >
                <h3 className="text-lg font-bold">{item.title}</h3>
                <p className="mt-2 text-sm text-gray-500">{item.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <div className="mb-4">
            <h2 className="text-xl font-bold">保管ロケーションマップ</h2>
            <p className="text-sm text-gray-500">
              未受取荷物があるロケーションを表示しています。
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="relative h-[420px] overflow-hidden rounded-2xl border bg-slate-100">
              <div className="absolute left-6 top-6 rounded-lg bg-white px-3 py-2 text-sm font-bold shadow">
                荷捌き場 / 保管エリア
              </div>

              <div className="absolute left-[8%] top-[20%] h-[60%] w-[22%] rounded-xl border-2 border-dashed border-gray-400 bg-white/50" />
              <div className="absolute left-[39%] top-[20%] h-[60%] w-[22%] rounded-xl border-2 border-dashed border-gray-400 bg-white/50" />
              <div className="absolute left-[70%] top-[20%] h-[60%] w-[22%] rounded-xl border-2 border-dashed border-gray-400 bg-white/50" />

              <div className="absolute bottom-6 left-6 rounded-lg bg-white px-3 py-2 text-xs text-gray-500 shadow">
                ※ 実際の図面画像は後で背景に差し替え可能
              </div>

              {locationSummary.length === 0 ? (
                <div className="flex h-full items-center justify-center text-gray-500">
                  現在、未受取荷物のあるロケーションはありません。
                </div>
              ) : (
                locationSummary.map((location) => (
                  <button
                    key={location.code}
                    onClick={() => setSelectedLocationCode(location.code)}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-xl px-4 py-3 text-white shadow-lg transition hover:scale-105 ${
                      selectedLocationCode === location.code
                        ? "bg-red-600"
                        : "bg-blue-600"
                    }`}
                    style={{
                      left: `${location.map_x}%`,
                      top: `${location.map_y}%`,
                    }}
                  >
                    <div className="text-base font-bold">{location.code}</div>
                    <div className="text-xs">{location.totalQuantity}個</div>
                  </button>
                ))
              )}
            </div>

            <div className="rounded-2xl border p-5">
              <h3 className="text-lg font-bold">選択中ロケーション</h3>

              {!selectedLocationCode ? (
                <p className="mt-3 text-sm text-gray-500">
                  マップ上のロケーションをクリックしてください。
                </p>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="rounded-xl bg-gray-100 p-4">
                    <p className="text-sm text-gray-500">ロケーション</p>
                    <p className="text-2xl font-bold">
                      {selectedLocationCode}
                    </p>
                  </div>

                  {selectedLocationPackages.map((item) => (
                    <div key={item.id} className="rounded-xl border p-4">
                      <p className="font-bold">
                        {item.profiles?.name ?? "宛先未設定"}
                      </p>
                      <p className="text-sm text-gray-500">
                        配送業者：{item.carriers?.name ?? "-"}
                      </p>
                      <p className="text-sm text-gray-500">
                        個数：{item.quantity}
                      </p>
                      <p className="text-sm text-gray-500">
                        到着：{new Date(item.arrived_at).toLocaleString("ja-JP")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-bold">自社宛の到着荷物一覧</h2>

          {loading ? (
            <p>読み込み中...</p>
          ) : packages.length === 0 ? (
            <p className="text-gray-500">現在、到着荷物はありません。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="p-3">宛先スタッフ</th>
                    <th className="p-3">配送業者</th>
                    <th className="p-3">個数</th>
                    <th className="p-3">保管ロケーション</th>
                    <th className="p-3">到着日時</th>
                    <th className="p-3">状況</th>
                    <th className="p-3">操作</th>
                  </tr>
                </thead>

                <tbody>
                  {packages.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="p-3">
                        {item.profiles?.name ?? "未設定"}
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

                      <td className="p-3">
                        {item.status === "unreceived" ? (
                          <button
                            onClick={() => handleReceive(item.id)}
                            className="rounded bg-blue-600 px-3 py-1 text-white"
                          >
                            受取済みにする
                          </button>
                        ) : (
                          <span className="text-gray-400">完了</span>
                        )}
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