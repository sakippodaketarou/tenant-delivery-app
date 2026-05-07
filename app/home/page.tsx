"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type PackageRow = {
  id: string;
  company_id: string;
  recipient_user_id: string;
  quantity: number;
  status: string;
  arrived_at: string;
  carriers: {
    name: string;
  } | null;
  profiles: {
    name: string;
    department: string | null;
  } | null;
};

type StaffRow = {
  id: string;
  company_id: string;
  name: string;
  department: string | null;
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
    map_x: number | null;
    map_y: number | null;
  } | null;
};

type LocationRow = {
  id: string;
  code: string;
  name: string | null;
  map_x: number | null;
  map_y: number | null;
};

type DepartmentCard = {
  department: string;
  company_id: string;
  count: number;
};

type MapLocationSummary = {
  locationId: string;
  code: string;
  name: string | null;
  map_x: number;
  map_y: number;
  departments: string[];
  totalQuantity: number;
  packageCount: number;
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

export default function HomePage() {
  const router = useRouter();

  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [staffList, setStaffList] = useState<StaffRow[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [departmentLocations, setDepartmentLocations] = useState<
    DepartmentLocation[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [draggingDepartment, setDraggingDepartment] =
    useState<DepartmentCard | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null
  );

  const fetchData = async () => {
    setLoading(true);

    const { data: packageData, error: packageError } = await supabase
      .from("packages")
      .select(`
        id,
        company_id,
        recipient_user_id,
        quantity,
        status,
        arrived_at,
        carriers (
          name
        ),
        profiles:recipient_user_id (
          name,
          department
        )
      `)
      .order("arrived_at", { ascending: false });

    if (packageError) {
      alert("荷物一覧取得エラー：" + packageError.message);
      setLoading(false);
      return;
    }

    const { data: staffData, error: staffError } = await supabase
      .from("profiles")
      .select("id, company_id, name, department")
      .order("department")
      .order("name");

    if (staffError) {
      alert("スタッフ取得エラー：" + staffError.message);
      setLoading(false);
      return;
    }

    const { data: locationData, error: locationError } = await supabase
      .from("locations")
      .select("id, code, name, map_x, map_y")
      .order("code");

    if (locationError) {
      alert("ロケーション取得エラー：" + locationError.message);
      setLoading(false);
      return;
    }

    const { data: departmentLocationData, error: departmentLocationError } =
      await supabase
        .from("department_locations")
        .select(`
          id,
          company_id,
          department,
          location_id,
          locations (
            id,
            code,
            name,
            map_x,
            map_y
          )
        `);

    if (departmentLocationError) {
      alert("部署ロケーション取得エラー：" + departmentLocationError.message);
      setLoading(false);
      return;
    }

    setPackages((packageData ?? []) as unknown as PackageRow[]);
    setStaffList((staffData ?? []) as StaffRow[]);
    setLocations((locationData ?? []) as LocationRow[]);
    setDepartmentLocations(
      (departmentLocationData ?? []) as unknown as DepartmentLocation[]
    );

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

    fetchData();
  };

  const departments = useMemo(() => {
    const map = new Map<string, DepartmentCard>();

    staffList.forEach((staff) => {
      const department = staff.department || "未分類";
      const key = `${staff.company_id}_${department}`;

      if (!map.has(key)) {
        map.set(key, {
          department,
          company_id: staff.company_id,
          count: 1,
        });
      } else {
        const current = map.get(key)!;
        current.count += 1;
      }
    });

    return Array.from(map.values());
  }, [staffList]);

  const unreceivedPackages = packages.filter((p) => p.status === "unreceived");
  const receivedPackages = packages.filter((p) => p.status === "received");

  const locationSummary = useMemo(() => {
    const map = new Map<string, MapLocationSummary>();

    unreceivedPackages.forEach((pkg) => {
      const department = pkg.profiles?.department;
      if (!department) return;

      const departmentLocation = departmentLocations.find(
        (item) =>
          item.company_id === pkg.company_id && item.department === department
      );

      if (!departmentLocation?.locations) return;

      const location = departmentLocation.locations;
      const locationId = location.id;
      const layout = layoutLocations.find((item) => item.code === location.code);

      const current = map.get(locationId);

      if (current) {
        current.totalQuantity += pkg.quantity;
        current.packageCount += 1;

        if (!current.departments.includes(department)) {
          current.departments.push(department);
        }
      } else {
        map.set(locationId, {
          locationId,
          code: location.code,
          name: location.name,
          map_x: layout?.x ?? location.map_x ?? 50,
          map_y: layout?.y ?? location.map_y ?? 50,
          departments: [department],
          totalQuantity: pkg.quantity,
          packageCount: 1,
        });
      }
    });

    return Array.from(map.values());
  }, [unreceivedPackages, departmentLocations]);

  const selectedLocationPackages = selectedLocationId
    ? unreceivedPackages.filter((pkg) => {
        const department = pkg.profiles?.department;
        if (!department) return false;

        const departmentLocation = departmentLocations.find(
          (item) =>
            item.company_id === pkg.company_id &&
            item.department === department &&
            item.location_id === selectedLocationId
        );

        return Boolean(departmentLocation);
      })
    : [];

  const menuItems = [
  {
    title: "荷物スキャン登録",
    description: "配送会社QRとスタッフQRを読み取ります",
    href: "/admin/register-package",
  },

  {
    title: "テナント / スタッフQR一覧",
    description: "QRコードを一覧で確認できます",
    href: "/admin/qr",
  },

  {
    title: "ロケーション設定",
    description: "部署ごとの保管場所を設定します",
    href: "/admin/location-map",
  },

  {
    title: "スタッフ管理",
    description: "スタッフ追加・編集・削除を行います",
    href: "/staff",
  },

  {
    title: "管理者チャット",
    description: "テナントからの問い合わせを確認します",
    href: "/admin/chat",
  },

  {
    title: "到着状況一覧",
    description: "登録済み荷物一覧を確認します",
    href: "/admin/packages",
  },
];

  const getDisplayLocation = (item: PackageRow) => {
    const department = item.profiles?.department;

    if (!department) return null;

    return departmentLocations.find(
      (location) =>
        location.company_id === item.company_id &&
        location.department === department
    );
  };

  const getLocationSummaryByCode = (code: string) => {
    return locationSummary.find((item) => item.code === code);
  };

  const getLocationRowByCode = (code: string) => {
    return locations.find((location) => location.code === code);
  };

  const getAssignedDepartmentsByLocationCode = (code: string) => {
    const location = getLocationRowByCode(code);
    if (!location) return [];

    return departmentLocations.filter(
      (item) => item.location_id === location.id
    );
  };

  const handleDropDepartment = async (locationCode: string) => {
    if (!draggingDepartment) return;

    const location = getLocationRowByCode(locationCode);

    if (!location) {
      alert(`${locationCode} が locations テーブルにありません。`);
      setDraggingDepartment(null);
      return;
    }

    const existing = departmentLocations.find(
      (item) =>
        item.company_id === draggingDepartment.company_id &&
        item.department === draggingDepartment.department
    );

    if (existing) {
      const { error } = await supabase
        .from("department_locations")
        .update({
          location_id: location.id,
        })
        .eq("id", existing.id);

      if (error) {
        alert("ロケーション更新エラー：" + error.message);
        setDraggingDepartment(null);
        return;
      }
    } else {
      const { error } = await supabase.from("department_locations").insert({
        company_id: draggingDepartment.company_id,
        department: draggingDepartment.department,
        location_id: location.id,
      });

      if (error) {
        alert("ロケーション登録エラー：" + error.message);
        setDraggingDepartment(null);
        return;
      }
    }

    setDraggingDepartment(null);
    await fetchData();
  };

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
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
          <div className="mb-4">
            <h2 className="text-xl font-bold">保管ロケーションマップ</h2>
            <p className="text-sm text-gray-500">
              部署カードをロケーションにドラッグ＆ドロップすると、部署ごとの保管場所を設定できます。
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[260px_1fr_300px]">
            <div className="rounded-2xl border p-5">
              <h3 className="mb-4 text-lg font-bold">部署カード</h3>

              {departments.length === 0 ? (
                <p className="text-sm text-gray-500">部署がありません。</p>
              ) : (
                <div className="space-y-3">
                  {departments.map((department) => (
                    <div
                      key={`${department.company_id}-${department.department}`}
                      draggable
                      onDragStart={() => setDraggingDepartment(department)}
                      onDragEnd={() => setDraggingDepartment(null)}
                      className={`cursor-grab rounded-xl border bg-white p-4 shadow-sm transition active:cursor-grabbing ${
                        draggingDepartment?.department === department.department
                          ? "scale-[1.02] border-blue-500"
                          : ""
                      }`}
                    >
                      <p className="font-bold">{department.department}</p>
                      <p className="text-sm text-gray-500">
                        {department.count}名
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="relative h-[650px] overflow-hidden rounded-2xl border bg-slate-100">
              <div className="absolute left-6 top-6 rounded-lg bg-white px-4 py-2 text-sm font-bold shadow">
                荷捌き場 / 保管エリア
              </div>

              {/* A/B/Cエリア */}
              <div className="absolute left-[10%] top-[15%] h-[50%] w-[50%] rounded-2xl border-2 border-dashed border-gray-400 bg-white/30" />

              {/* Dエリア */}
              <div className="absolute left-[10%] top-[65%] h-[20%] w-[65%] rounded-2xl border-2 border-dashed border-gray-400 bg-white/30" />

              {/* Eエリア */}
              <div className="absolute left-[70%] top-[15%] h-[50%] w-[20%] rounded-2xl border-2 border-dashed border-gray-400 bg-white/30" />
              {layoutLocations.map((location) => {
                const summary = getLocationSummaryByCode(location.code);
                const assignedDepartments =
                  getAssignedDepartmentsByLocationCode(location.code);
                const hasPackage = Boolean(summary);

                return (
                  <div
                    key={location.code}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDropDepartment(location.code)}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: `${location.x}%`,
                      top: `${location.y}%`,
                    }}
                  >
                    <button
                      onClick={() =>
                        summary
                          ? setSelectedLocationId(summary.locationId)
                          : setSelectedLocationId(
                              getLocationRowByCode(location.code)?.id ?? null
                            )
                      }
                      className={`flex h-16 w-16 flex-col items-center justify-center rounded-xl border-2 text-sm font-bold shadow-lg transition hover:scale-105 ${
                        hasPackage
                          ? selectedLocationId === summary?.locationId
                            ? "border-red-700 bg-red-600 text-white"
                            : "border-blue-700 bg-blue-600 text-white"
                          : "border-black bg-white text-black"
                      }`}
                    >
                      <span>{location.code}</span>
                      {summary && (
                        <span className="mt-1 text-[11px]">
                          {summary.totalQuantity}個
                        </span>
                      )}
                    </button>

                    {assignedDepartments.length > 0 && (
                      <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex w-[90px] -translate-x-1/2 -translate-y-1/2 flex-col gap-1">
                        {assignedDepartments.map((item) => (
                          <div
                            key={item.id}
                            className="truncate rounded-md bg-white/95 px-2 py-1 text-center text-[10px] font-bold text-black shadow-md backdrop-blur"
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
                ※ 部署カードをA1〜E3へドロップ
              </div>
            </div>

            <div className="rounded-2xl border p-5">
              <h3 className="text-lg font-bold">選択中ロケーション</h3>

              {!selectedLocationId ? (
                <p className="mt-3 text-sm text-gray-500">
                  ロケーションをクリックしてください。
                </p>
              ) : selectedLocationPackages.length === 0 ? (
                <p className="mt-3 text-sm text-gray-500">
                  このロケーションの未受取荷物はありません。
                </p>
              ) : (
                <div className="mt-4 space-y-4">
                  {selectedLocationPackages.map((item) => (
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
                      <p className="text-sm text-gray-500">
                        到着：
                        {new Date(item.arrived_at).toLocaleString("ja-JP")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-bold">到着荷物一覧</h2>

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
                    <th className="p-3">部署</th>
                    <th className="p-3">配送業者</th>
                    <th className="p-3">個数</th>
                    <th className="p-3">表示ロケーション</th>
                    <th className="p-3">到着日時</th>
                    <th className="p-3">状況</th>
                    <th className="p-3">操作</th>
                  </tr>
                </thead>

                <tbody>
                  {packages.map((item) => {
                    const departmentLocation = getDisplayLocation(item);

                    return (
                      <tr key={item.id} className="border-b">
                        <td className="p-3">
                          {item.profiles?.name ?? "未設定"}
                        </td>

                        <td className="p-3">
                          {item.profiles?.department ?? "-"}
                        </td>

                        <td className="p-3">{item.carriers?.name ?? "-"}</td>

                        <td className="p-3">{item.quantity}</td>

                        <td className="p-3">
                          {departmentLocation?.locations?.code ?? "未設定"}
                          {departmentLocation?.locations?.name && (
                            <span className="ml-2 text-xs text-gray-500">
                              {departmentLocation.locations.name}
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}