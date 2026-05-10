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
  carrier_id: string | null;
  recipient_staff_id: string | null;
  quantity: number;
  status: string;
  arrived_at: string;
  received_at: string | null;
  carriers: {
    name: string;
  } | null;
  staffs: {
    staff_name: string;
    department: string | null;
    email: string | null;
    group_email: string | null;
  } | null;
};

type DepartmentLocation = {
  id: string;
  company_id: string;
  department: string;
  location_id: string;
  locations: {
    code: string;
    name: string | null;
  } | null;
};

export default function TenantPackagesPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [departmentLocations, setDepartmentLocations] = useState<
    DepartmentLocation[]
  >([]);
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
      alert("ログイン情報の取得に失敗しました。");
      setLoading(false);
      return;
    }

    setProfile(profileData as MyProfile);

    const { data: packageData, error: packageError } = await supabase
      .from("packages")
      .select(`
        id,
        company_id,
        carrier_id,
        recipient_staff_id,
        quantity,
        status,
        arrived_at,
        received_at,
        carriers (
          name
        ),
        staffs:recipient_staff_id (
          staff_name,
          department,
          email,
          group_email
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

  const unreceivedPackages = packages.filter(
    (item) => item.status === "unreceived"
  );

  const receivedPackages = packages.filter(
    (item) => item.status === "received"
  );

  const totalQuantity = packages.reduce((sum, item) => sum + item.quantity, 0);

  const unreceivedQuantity = unreceivedPackages.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const getLocationText = (item: PackageRow) => {
    const department = item.staffs?.department;

    if (!department) return "未設定";

    const departmentLocation = departmentLocations.find(
      (location) =>
        location.company_id === item.company_id &&
        location.department === department
    );

    if (!departmentLocation?.locations) return "未設定";

    return `${departmentLocation.locations.code}${
      departmentLocation.locations.name
        ? ` ${departmentLocation.locations.name}`
        : ""
    }`;
  };

  const handleReceive = async (packageId: string) => {
    const ok = confirm("この荷物を受取済みにしますか？");

    if (!ok) return;

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

  const groupedByDepartment = useMemo(() => {
    const map = new Map<string, PackageRow[]>();

    unreceivedPackages.forEach((item) => {
      const department = item.staffs?.department ?? "未分類";

      if (!map.has(department)) {
        map.set(department, []);
      }

      map.get(department)!.push(item);
    });

    return Array.from(map.entries());
  }, [unreceivedPackages]);

  const alertPackages = useMemo(() => {
    const now = new Date().getTime();

    return unreceivedPackages.filter((item) => {
      const arrived = new Date(item.arrived_at).getTime();
      const days = Math.floor((now - arrived) / (1000 * 60 * 60 * 24));

      return days >= 5;
    });
  }, [unreceivedPackages]);

  const getElapsedDays = (arrivedAt: string) => {
    const now = new Date().getTime();
    const arrived = new Date(arrivedAt).getTime();

    return Math.floor((now - arrived) / (1000 * 60 * 60 * 24));
  };

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between rounded-2xl bg-white p-6 shadow">
          <div>
            <h1 className="text-2xl font-bold">到着状況一覧</h1>
            <p className="text-sm text-gray-500">
              会社アカウントでログインし、全スタッフ宛の荷物を確認できます。
            </p>
          </div>

          <button
            onClick={() => router.push("/tenant/home")}
            className="rounded-lg bg-black px-4 py-2 text-white"
          >
            テナント画面へ戻る
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">未受取件数</p>
            <p className="mt-2 text-3xl font-bold">
              {unreceivedPackages.length}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">未受取個数</p>
            <p className="mt-2 text-3xl font-bold">{unreceivedQuantity}</p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">受取済み</p>
            <p className="mt-2 text-3xl font-bold">
              {receivedPackages.length}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">合計個数</p>
            <p className="mt-2 text-3xl font-bold">{totalQuantity}</p>
          </div>
        </div>

        {alertPackages.length > 0 && (
          <div className="rounded-2xl border border-red-300 bg-red-50 p-6 shadow">
            <h2 className="text-xl font-bold text-red-700">
              長期未受取アラート
            </h2>
            <p className="mt-1 text-sm text-red-600">
              到着から5日以上経過した未受取荷物があります。
            </p>

            <div className="mt-4 space-y-2">
              {alertPackages.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl bg-white p-4 text-sm shadow-sm"
                >
                  <span className="font-bold">
                    {item.staffs?.staff_name ?? "宛先未設定"}
                  </span>
                  <span className="ml-2">
                    {getElapsedDays(item.arrived_at)}日経過 / {item.quantity}個
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-bold">部署別 未受取荷物</h2>

          {loading ? (
            <p>読み込み中...</p>
          ) : groupedByDepartment.length === 0 ? (
            <p className="text-gray-500">現在、未受取荷物はありません。</p>
          ) : (
            <div className="space-y-6">
              {groupedByDepartment.map(([department, items]) => {
                const departmentQuantity = items.reduce(
                  (sum, item) => sum + item.quantity,
                  0
                );

                const location = getLocationText(items[0]);

                return (
                  <div key={department} className="rounded-2xl border p-5">
                    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-lg font-bold">{department}</h3>
                        <p className="text-sm text-gray-500">
                          保管場所：{location}
                        </p>
                      </div>

                      <div className="rounded-xl bg-blue-600 px-4 py-2 text-white">
                        合計 {departmentQuantity} 個
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="border-b bg-gray-50 text-left">
                            <th className="p-3">宛先スタッフ</th>
                            <th className="p-3">配送業者</th>
                            <th className="p-3">個数</th>
                            <th className="p-3">保管場所</th>
                            <th className="p-3">到着日時</th>
                            <th className="p-3">経過日数</th>
                            <th className="p-3">通知先</th>
                            <th className="p-3">操作</th>
                          </tr>
                        </thead>

                        <tbody>
                          {items.map((item) => {
                            const days = getElapsedDays(item.arrived_at);

                            return (
                              <tr
                                key={item.id}
                                className={`border-b ${
                                  days >= 5 ? "bg-red-50" : ""
                                }`}
                              >
                                <td className="p-3 font-bold">
                                  {item.staffs?.staff_name ?? "未設定"}
                                </td>

                                <td className="p-3">
                                  {item.carriers?.name ?? "-"}
                                </td>

                                <td className="p-3">{item.quantity}</td>

                                <td className="p-3">
                                  {getLocationText(item)}
                                </td>

                                <td className="p-3">
                                  {new Date(item.arrived_at).toLocaleString(
                                    "ja-JP"
                                  )}
                                </td>

                                <td className="p-3">
                                  <span
                                    className={`rounded-full px-2 py-1 text-xs font-bold ${
                                      days >= 5
                                        ? "bg-red-100 text-red-700"
                                        : "bg-gray-100 text-gray-600"
                                    }`}
                                  >
                                    {days}日
                                  </span>
                                </td>

                                <td className="p-3">
                                  <div className="text-xs text-gray-500">
                                    <p>本人：{item.staffs?.email ?? "-"}</p>
                                    <p>
                                      共有：
                                      {item.staffs?.group_email ?? "-"}
                                    </p>
                                  </div>
                                </td>

                                <td className="p-3">
                                  <button
                                    onClick={() => handleReceive(item.id)}
                                    className="rounded bg-blue-600 px-3 py-1 text-white"
                                  >
                                    受取済みにする
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-bold">全荷物履歴</h2>

          {loading ? (
            <p>読み込み中...</p>
          ) : packages.length === 0 ? (
            <p className="text-gray-500">荷物履歴はありません。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="p-3">宛先スタッフ</th>
                    <th className="p-3">部署</th>
                    <th className="p-3">配送業者</th>
                    <th className="p-3">個数</th>
                    <th className="p-3">保管場所</th>
                    <th className="p-3">到着日時</th>
                    <th className="p-3">受取日時</th>
                    <th className="p-3">状況</th>
                  </tr>
                </thead>

                <tbody>
                  {packages.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="p-3">
                        {item.staffs?.staff_name ?? "未設定"}
                      </td>

                      <td className="p-3">
                        {item.staffs?.department ?? "-"}
                      </td>

                      <td className="p-3">{item.carriers?.name ?? "-"}</td>

                      <td className="p-3">{item.quantity}</td>

                      <td className="p-3">{getLocationText(item)}</td>

                      <td className="p-3">
                        {new Date(item.arrived_at).toLocaleString("ja-JP")}
                      </td>

                      <td className="p-3">
                        {item.received_at
                          ? new Date(item.received_at).toLocaleString("ja-JP")
                          : "-"}
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