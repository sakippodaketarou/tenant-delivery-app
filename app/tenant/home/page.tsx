"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type MyProfile = {
  id: string;
  company_id: string;
  name: string;
};

type PackageRow = {
  id: string;
  company_id: string;
  recipient_staff_id: string | null;
  quantity: number;
  status: string;
  shipper_name: string | null;
  arrived_at: string;
  carriers: { name: string } | null;
  staffs: {
    staff_name: string;
    department: string | null;
  } | null;
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
  const [departmentLocations, setDepartmentLocations] = useState<
    DepartmentLocation[]
  >([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null
  );
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
      .select("id, company_id, name")
      .eq("id", user.id)
      .single();

    if (profileError || !profileData) {
      alert("ログイン情報取得エラー");
      setLoading(false);
      return;
    }

    setProfile(profileData as MyProfile);

    const { data: packageData, error: packageError } = await supabase
      .from("packages")
      .select(`
        id,
        company_id,
        recipient_staff_id,
        quantity,
        status,
        shipper_name,
        arrived_at,
        carriers (
          name
        ),
        staffs:recipient_staff_id (
          staff_name,
          department
        )
      `)
      .eq("company_id", profileData.company_id)
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
        locations (
          id,
          code,
          name
        )
      `)
      .eq("company_id", profileData.company_id);

    if (locationError) {
      alert("ロケーション取得エラー：" + locationError.message);
      setLoading(false);
      return;
    }

    setPackages((packageData ?? []) as unknown as PackageRow[]);
    setDepartmentLocations(
      (locationData ?? []) as unknown as DepartmentLocation[]
    );

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);
  
  useEffect(() => {
  if (!profile?.company_id) return;

  const channel = supabase
    .channel(`tenant-home-packages-${profile.company_id}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "packages",
        filter: `company_id=eq.${profile.company_id}`,
      },
      async () => {
        await fetchData();
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "department_locations",
        filter: `company_id=eq.${profile.company_id}`,
      },
      async () => {
        await fetchData();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [profile?.company_id]);
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

  const getDisplayLocation = (pkg: PackageRow) => {
    const department = pkg.staffs?.department;

    if (!department) return null;

    return departmentLocations.find(
      (item) =>
        item.company_id === pkg.company_id && item.department === department
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

  const selectedLocation = selectedLocationId
    ? departmentLocations.find((item) => item.location_id === selectedLocationId)
        ?.locations
    : null;

  const menuItems = [
    {
      title: "スタッフ管理",
      description: "スタッフ登録・CSV取込・QR確認",
      href: "/tenant/staff",
    },
    {
      title: "到着状況一覧",
      description: "未受取・受取済み・CSV出力",
      href: "/tenant/packages",
    },
    {
      title: "管理者チャット",
      description: "管理者へ問い合わせ",
      href: "/tenant/chat",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between rounded-2xl bg-white p-6 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              テナント荷物確認画面
            </h1>
            <p className="text-sm text-slate-500">
              {profile?.name ?? ""} さんの会社宛てに届いた荷物を確認できます。
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-xl bg-slate-900 px-4 py-2 text-white"
          >
            ログアウト
          </button>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm font-bold text-slate-500">未受取件数</p>
          <div className="mt-2 flex items-end gap-3">
            <p className="text-5xl font-bold text-slate-900">
              {unreceivedPackages.length}
            </p>
            <p className="pb-2 text-sm text-slate-500">
              件 / {unreceivedQuantity} 個
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-bold text-slate-900">
            アクセスメニュー
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
          <h2 className="mb-2 text-xl font-bold text-slate-900">
            保管ロケーションマップ
          </h2>
          <p className="mb-4 text-sm text-slate-500">
            自社の未受取荷物があるロケーションを表示しています。
          </p>

          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <div className="relative h-[650px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
              <div className="absolute left-6 top-6 rounded-xl bg-white px-4 py-2 text-sm font-bold shadow-sm">
                荷捌き場 / 保管エリア
              </div>

              <div className="absolute left-[16%] top-[34%] h-[42%] w-[34%] rounded-2xl border-2 border-dashed border-slate-300 bg-white/40" />
              <div className="absolute left-[48%] top-[72%] h-[16%] w-[34%] rounded-2xl border-2 border-dashed border-slate-300 bg-white/40" />
              <div className="absolute left-[76%] top-[22%] h-[42%] w-[14%] rounded-2xl border-2 border-dashed border-slate-300 bg-white/40" />

              {locationSummary.map((location) => {
                const hasPackage = location.totalQuantity > 0;
                const locationId =
                  location.assignedDepartments[0]?.location_id ?? null;

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
                      className={`flex h-16 w-16 flex-col items-center justify-center rounded-xl border-2 text-sm font-bold shadow-sm transition hover:scale-105 ${
                        hasPackage
                          ? selectedLocationId === locationId
                            ? "border-blue-800 bg-blue-700 text-white"
                            : "border-blue-600 bg-blue-500 text-white"
                          : "border-slate-300 bg-white text-slate-900"
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
                      <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex w-[92px] -translate-x-1/2 -translate-y-1/2 flex-col gap-1">
                        {location.assignedDepartments.map((item) => (
                          <div
                            key={item.id}
                            className="truncate rounded-md bg-white/95 px-2 py-1 text-center text-[10px] font-bold text-slate-900 shadow-sm"
                          >
                            {item.department}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="absolute bottom-6 left-6 rounded-xl bg-white px-4 py-2 text-xs text-slate-500 shadow-sm">
                ※ 青色：未受取荷物あり
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="text-lg font-bold text-slate-900">
                選択中ロケーション
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                {selectedLocation
                  ? `${selectedLocation.code} ${
                      selectedLocation.name ?? ""
                    }`
                  : "未選択"}
              </p>

              <div className="mt-4 max-h-[520px] space-y-4 overflow-y-auto pr-2">
                {!selectedLocationId ? (
                  <p className="text-sm text-slate-500">
                    荷物があるロケーションをクリックしてください。
                  </p>
                ) : selectedPackages.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    このロケーションの未受取荷物はありません。
                  </p>
                ) : (
                  selectedPackages.map((item) => (
                    <div key={item.id} className="rounded-xl border p-4">
                      <p className="font-bold">
                        {item.staffs?.staff_name ?? "宛先未設定"}
                      </p>
                      <p className="text-sm text-slate-500">
                        部署：{item.staffs?.department ?? "-"}
                      </p>
                      <p className="text-sm text-slate-500">
                        荷主：{item.shipper_name ?? "-"}
                      </p>
                      <p className="text-sm text-slate-500">
                        配送業者：{item.carriers?.name ?? "-"}
                      </p>
                      <p className="text-sm text-slate-500">
                        個数：{item.quantity}
                      </p>
                      <p className="text-xs text-slate-400">
                        到着：
                        {new Date(item.arrived_at).toLocaleString("ja-JP")}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {loading && (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            読み込み中...
          </div>
        )}
      </div>
    </main>
  );
}