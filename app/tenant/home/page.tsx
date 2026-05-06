"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type MyProfile = {
  id: string;
  company_id: string;
  name: string;
  department: string | null;
};

type PackageRow = {
  id: string;
  company_id: string;
  recipient_user_id: string;
  quantity: number;
  status: string;
  arrived_at: string;
  carriers: { name: string } | null;
  profiles: { name: string; department: string | null } | null;
};

type DepartmentLocation = {
  id: string;
  company_id: string;
  department: string;
  location_id: string;
  locations: {
    id: string;
    code: string;
    name: string | null;
  } | null;
};

const layoutLocations = [
  { code: "A1", x: 20, y: 55 },
  { code: "A2", x: 35, y: 55 },
  { code: "A3", x: 50, y: 55 },
  { code: "B1", x: 20, y: 40 },
  { code: "B2", x: 35, y: 40 },
  { code: "B3", x: 50, y: 40 },
  { code: "C1", x: 20, y: 25 },
  { code: "C2", x: 35, y: 25 },
  { code: "C3", x: 50, y: 25 },
  { code: "D1", x: 20, y: 75 },
  { code: "D2", x: 35, y: 75 },
  { code: "D3", x: 50, y: 75 },
  { code: "D4", x: 65, y: 75 },
  { code: "E1", x: 80, y: 25 },
  { code: "E2", x: 80, y: 40 },
  { code: "E3", x: 80, y: 55 },
];

export default function TenantHomePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [departmentLocations, setDepartmentLocations] = useState<DepartmentLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: myProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, company_id, name, department")
      .eq("id", user.id)
      .single();

    if (profileError || !myProfile) {
      alert("プロフィール取得エラー：" + (profileError?.message ?? ""));
      setLoading(false);
      return;
    }

    setProfile(myProfile as MyProfile);

    const { data: packageData, error: packageError } = await supabase
      .from("packages")
      .select(`
        id,
        company_id,
        recipient_user_id,
        quantity,
        status,
        arrived_at,
        carriers ( name ),
        profiles:recipient_user_id ( name, department )
      `)
      .eq("company_id", myProfile.company_id)
      .order("arrived_at", { ascending: false });

    if (packageError) {
      alert("荷物取得エラー：" + packageError.message);
      setLoading(false);
      return;
    }

    const { data: locationData, error: locationError } = await supabase
      .from("department_locations")
      .select(`
        id,
        company_id,
        department,
        location_id,
        locations ( id, code, name )
      `)
      .eq("company_id", myProfile.company_id);

    if (locationError) {
      alert("ロケーション取得エラー：" + locationError.message);
      setLoading(false);
      return;
    }

    setPackages((packageData ?? []) as unknown as PackageRow[]);
    setDepartmentLocations((locationData ?? []) as unknown as DepartmentLocation[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

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

    await fetchData();
  };

  const unreceivedPackages = packages.filter((p) => p.status === "unreceived");
  const receivedPackages = packages.filter((p) => p.status === "received");

  const getDisplayLocation = (pkg: PackageRow) => {
    const department = pkg.profiles?.department;
    if (!department) return null;

    return departmentLocations.find(
      (item) => item.company_id === pkg.company_id && item.department === department
    );
  };

  const locationSummary = useMemo(() => {
    return layoutLocations.map((layout) => {
      const assignedDepartments = departmentLocations.filter(
        (item) => item.locations?.code === layout.code
      );

      const relatedPackages = unreceivedPackages.filter((pkg) => {
        const location = getDisplayLocation(pkg);
        return location?.locations?.code === layout.code;
      });

      const totalQuantity = relatedPackages.reduce(
        (sum, item) => sum + item.quantity,
        0
      );

      return {
        ...layout,
        assignedDepartments,
        relatedPackages,
        totalQuantity,
      };
    });
  }, [departmentLocations, unreceivedPackages]);

  const selectedPackages = selectedLocationId
    ? unreceivedPackages.filter((pkg) => {
        const location = getDisplayLocation(pkg);
        return location?.location_id === selectedLocationId;
      })
    : [];

  const menuItems = [
    {
      title: "スタッフ管理",
      description: "自社スタッフの確認・追加をします",
      href: "/tenant/staff",
    },
    {
      title: "到着状況一覧",
      description: "自社宛の荷物状況を確認します",
      href: "/tenant/packages",
    },
    {
      title: "管理者チャット",
      description: "管理者へ個別連絡できます",
      href: "/tenant/chat",
    },
  ];

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between rounded-2xl bg-white p-6 shadow">
          <div>
            <h1 className="text-2xl font-bold">テナント荷物確認画面</h1>
            <p className="text-sm text-gray-500">
              {profile?.name ?? ""} さんの会社宛てに届いた荷物を確認できます。
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
            <p className="mt-2 text-3xl font-bold">{unreceivedPackages.length}</p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">受取済み</p>
            <p className="mt-2 text-3xl font-bold">{receivedPackages.length}</p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">合計</p>
            <p className="mt-2 text-3xl font-bold">{packages.length}</p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-bold">アクセスメニュー</h2>

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
          <h2 className="mb-2 text-xl font-bold">保管ロケーションマップ</h2>
          <p className="mb-4 text-sm text-gray-500">
            自社の未受取荷物があるロケーションを表示しています。
          </p>

          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
            <div className="relative h-[650px] overflow-hidden rounded-2xl border bg-slate-100">
              <div className="absolute left-6 top-6 rounded-lg bg-white px-4 py-2 text-sm font-bold shadow">
                荷捌き場 / 保管エリア
              </div>

              <div className="absolute left-[16%] top-[34%] h-[42%] w-[34%] rounded-2xl border-2 border-dashed border-gray-400 bg-white/30" />
              <div className="absolute left-[48%] top-[72%] h-[16%] w-[34%] rounded-2xl border-2 border-dashed border-gray-400 bg-white/30" />
              <div className="absolute left-[76%] top-[22%] h-[42%] w-[14%] rounded-2xl border-2 border-dashed border-gray-400 bg-white/30" />

              {locationSummary.map((location) => {
                const hasPackage = location.totalQuantity > 0;
                const locationId = location.assignedDepartments[0]?.location_id ?? null;

                return (
                  <div
                    key={location.code}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: `${location.x}%`,
                      top: `${location.y}%`,
                    }}
                  >
                    <button
                      onClick={() => setSelectedLocationId(locationId)}
                      className={`flex h-16 w-16 flex-col items-center justify-center rounded-xl border-2 text-sm font-bold shadow-lg transition hover:scale-105 ${
                        hasPackage
                          ? selectedLocationId === locationId
                            ? "border-red-700 bg-red-600 text-white"
                            : "border-blue-700 bg-blue-600 text-white"
                          : "border-black bg-white text-black"
                      }`}
                    >
                      <span>{location.code}</span>
                      {hasPackage && (
                        <span className="mt-1 text-[11px]">
                          {location.totalQuantity}個
                        </span>
                      )}
                    </button>

                    {location.assignedDepartments.length > 0 && (
                      <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex w-[90px] -translate-x-1/2 -translate-y-1/2 flex-col gap-1">
                        {location.assignedDepartments.map((item) => (
                          <div
                            key={item.id}
                            className="truncate rounded-md bg-white/95 px-2 py-1 text-center text-[10px] font-bold text-black shadow-md"
                            title={item.department}
                          >
                            {item.department}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="absolute bottom-6 left-6 rounded-lg bg-white px-4 py-2 text-xs text-gray-500 shadow">
                ※ 青色：未受取荷物あり
              </div>
            </div>

            <div className="rounded-2xl border p-5">
              <h3 className="text-lg font-bold">選択中ロケーション</h3>

              {!selectedLocationId ? (
                <p className="mt-3 text-sm text-gray-500">
                  荷物があるロケーションをクリックしてください。
                </p>
              ) : selectedPackages.length === 0 ? (
                <p className="mt-3 text-sm text-gray-500">
                  このロケーションの未受取荷物はありません。
                </p>
              ) : (
                <div className="mt-4 space-y-4">
                  {selectedPackages.map((item) => (
                    <div key={item.id} className="rounded-xl border p-4">
                      <p className="font-bold">
                        {item.profiles?.name ?? "宛先未設定"}
                      </p>
                      <p className="text-sm text-gray-500">
                        部署：{item.profiles?.department ?? "-"}
                      </p>
                      <p className="text-sm text-gray-500">
                        配送業者：{item.carriers?.name ?? "-"}
                      </p>
                      <p className="text-sm text-gray-500">
                        個数：{item.quantity}
                      </p>
                      <button
                        onClick={() => handleReceive(item.id)}
                        className="mt-3 rounded bg-blue-600 px-3 py-1 text-white"
                      >
                        受取済みにする
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {loading && (
          <div className="rounded-2xl bg-white p-6 shadow">
            読み込み中...
          </div>
        )}
      </div>
    </main>
  );
}