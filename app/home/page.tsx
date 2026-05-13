"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Profile = {
  id: string;
  name: string | null;
  role: string | null;
};

type PackageRow = {
  id: string;
  company_id: string;
  quantity: number;
  status: string;
  shipper_name: string | null;
  arrived_at: string;
  companies: {
    name: string;
  } | null;
  staffs: {
    staff_name: string;
    department: string | null;
  } | null;
};

export default function HomePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
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
      .select("id, name, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profileData) {
      alert("ログイン情報の取得に失敗しました。");
      setLoading(false);
      return;
    }

    if (
      profileData.role !== "admin" &&
      profileData.role !== "tenant_admin"
    ) {
      router.push("/tenant/home");
      return;
    }

    setProfile(profileData as Profile);

    const { data: packageData, error: packageError } = await supabase
      .from("packages")
      .select(`
        id,
        company_id,
        quantity,
        status,
        shipper_name,
        arrived_at,
        companies (
          name
        ),
        staffs:recipient_staff_id (
          staff_name,
          department
        )
      `)
      .order("arrived_at", { ascending: false });

    if (packageError) {
      alert("荷物取得エラー：" + packageError.message);
      setLoading(false);
      return;
    }

    setPackages((packageData ?? []) as unknown as PackageRow[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("admin-home-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "packages",
        },
        async () => {
          await fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const unreceivedPackages = packages.filter(
    (item) => item.status === "unreceived"
  );

  const unreceivedQuantity = unreceivedPackages.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const todayPackages = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    return packages.filter(
      (item) => new Date(item.arrived_at).toISOString().slice(0, 10) === today
    );
  }, [packages]);

  const alertPackages = useMemo(() => {
    const now = new Date().getTime();

    return unreceivedPackages.filter((item) => {
      const arrived = new Date(item.arrived_at).getTime();
      const days = Math.floor((now - arrived) / (1000 * 60 * 60 * 24));
      return days >= 5;
    });
  }, [unreceivedPackages]);

  const menuItems = [
    {
      title: "荷物スキャン登録",
      description: "配送会社・荷主・スタッフQRで荷物登録",
      href: "/admin/register-package",
    },
    {
      title: "到着状況一覧",
      description: "未受取・受取済み・CSV出力",
      href: "/admin/packages",
    },
    {
      title: "テナント / QR一覧",
      description: "会社別のスタッフQRを確認・印刷",
      href: "/admin/qr",
    },
    {
      title: "ロケーション設定",
      description: "登録企業別の部署ロケーションを設定",
      href: "/admin/location-map",
    },
    {
      title: "管理者チャット",
      description: "テナントからの問い合わせ確認",
      href: "/admin/chat",
    },
  ];

  const recentUnreceived = unreceivedPackages.slice(0, 6);

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-bold text-blue-600">
              Tenant Delivery Admin
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              管理者ホーム
            </h1>
            <p className="text-sm text-slate-500">
              全テナントの到着荷物・未受取・ロケーション・通知状況を管理します。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={fetchData}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-bold text-slate-700 transition hover:bg-slate-100"
            >
              更新
            </button>

            <button
              onClick={handleLogout}
              className="rounded-xl bg-slate-900 px-4 py-2 font-bold text-white transition hover:bg-slate-700"
            >
              ログアウト
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm font-bold text-slate-500">未受取件数</p>

          <div className="mt-2 flex flex-wrap items-end gap-3">
            <p className="text-5xl font-bold text-slate-900">
              {unreceivedPackages.length}
            </p>

            <p className="pb-2 text-sm text-slate-500">
              件 / {unreceivedQuantity} 個
            </p>

            {alertPackages.length > 0 && (
              <span className="mb-1 rounded-full bg-red-100 px-3 py-1 text-sm font-bold text-red-700">
                5日超過 {alertPackages.length}件
              </span>
            )}

            <span className="mb-1 rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">
              本日到着 {todayPackages.length}件
            </span>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-bold text-slate-900">
            アクセスメニュー
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            {menuItems.map((item) => (
              <button
                key={item.title}
                onClick={() => router.push(item.href)}
                className="rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <h3 className="text-lg font-bold text-slate-900">
                  {item.title}
                </h3>

                <p className="mt-2 text-sm text-slate-500">
                  {item.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                最近の未受取荷物
              </h2>
              <p className="text-sm text-slate-500">
                直近の未受取荷物のみ表示しています。詳細は到着状況一覧で確認してください。
              </p>
            </div>

            <button
              onClick={() => router.push("/admin/packages")}
              className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white"
            >
              一覧を見る
            </button>
          </div>

          {loading ? (
            <p className="text-slate-500">読み込み中...</p>
          ) : recentUnreceived.length === 0 ? (
            <p className="text-slate-500">現在、未受取荷物はありません。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left">
                    <th className="p-3">会社</th>
                    <th className="p-3">宛先</th>
                    <th className="p-3">部署</th>
                    <th className="p-3">荷主</th>
                    <th className="p-3">個数</th>
                    <th className="p-3">到着日時</th>
                  </tr>
                </thead>

                <tbody>
                  {recentUnreceived.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="p-3">{item.companies?.name ?? "-"}</td>

                      <td className="p-3 font-bold">
                        {item.staffs?.staff_name ?? "未設定"}
                      </td>

                      <td className="p-3">
                        {item.staffs?.department ?? "-"}
                      </td>

                      <td className="p-3">{item.shipper_name ?? "-"}</td>

                      <td className="p-3">{item.quantity}</td>

                      <td className="p-3">
                        {new Date(item.arrived_at).toLocaleString("ja-JP")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {profile && (
          <p className="text-right text-xs text-slate-400">
            login: {profile.name ?? "-"} / {profile.role ?? "-"}
          </p>
        )}
      </div>
    </main>
  );
}