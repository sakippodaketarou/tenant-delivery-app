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
  shipper_name: string | null;
  arrived_at: string;
  received_at: string | null;
  received_by: string | null;
  received_proof_at: string | null;
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

  const [statusFilter, setStatusFilter] = useState("unreceived");
  const [dateFilter, setDateFilter] = useState("");
  const [keyword, setKeyword] = useState("");

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
        shipper_name,
        arrived_at,
        received_at,
        received_by,
        received_proof_at,
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

  const getElapsedDays = (arrivedAt: string) => {
    const now = new Date().getTime();
    const arrived = new Date(arrivedAt).getTime();

    return Math.floor((now - arrived) / (1000 * 60 * 60 * 24));
  };

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

  const filteredPackages = useMemo(() => {
    const lowerKeyword = keyword.trim().toLowerCase();

    return packages.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }

      if (dateFilter) {
        const arrivedDate = new Date(item.arrived_at)
          .toISOString()
          .slice(0, 10);

        if (arrivedDate !== dateFilter) {
          return false;
        }
      }

      if (lowerKeyword) {
        const targetText = [
          item.staffs?.staff_name,
          item.staffs?.department,
          item.carriers?.name,
          item.shipper_name,
          item.status,
          item.received_by,
          getLocationText(item),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!targetText.includes(lowerKeyword)) {
          return false;
        }
      }

      return true;
    });
  }, [packages, statusFilter, dateFilter, keyword, departmentLocations]);

  const unreceivedPackages = packages.filter(
    (item) => item.status === "unreceived"
  );

  const receivedPackages = packages.filter(
    (item) => item.status === "received"
  );

  const alertPackages = unreceivedPackages.filter(
    (item) => getElapsedDays(item.arrived_at) >= 5
  );

  const filteredQuantity = filteredPackages.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const handleReceive = async (packageId: string) => {
    const receivedBy = prompt("受取者名を入力してください。");

    if (!receivedBy || !receivedBy.trim()) {
      alert("受取者名は必須です。");
      return;
    }

    const ok = confirm(`${receivedBy} さんで受取済みにしますか？`);

    if (!ok) return;

    const { error } = await supabase
      .from("packages")
      .update({
        status: "received",
        received_by: receivedBy.trim(),
        received_at: new Date().toISOString(),
        received_proof_at: new Date().toISOString(),
      })
      .eq("id", packageId);

    if (error) {
      alert("受取処理エラー：" + error.message);
      return;
    }

    await fetchData();
  };

  const handleReturnUnreceived = async (packageId: string) => {
    const ok = confirm("この荷物を未受取に戻しますか？");

    if (!ok) return;

    const { error } = await supabase
      .from("packages")
      .update({
        status: "unreceived",
        received_by: null,
        received_at: null,
        received_proof_at: null,
      })
      .eq("id", packageId);

    if (error) {
      alert("状態変更エラー：" + error.message);
      return;
    }

    await fetchData();
  };

  const escapeCsv = (value: string | number | null | undefined) => {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  };

  const exportCsv = () => {
    if (filteredPackages.length === 0) {
      alert("出力対象がありません。");
      return;
    }

    const headers = [
      "状態",
      "宛先スタッフ",
      "部署",
      "荷主",
      "配送業者",
      "個数",
      "保管場所",
      "到着日時",
      "経過日数",
      "受取者",
      "受取日時",
      "本人メール",
      "共有メール",
    ];

    const rows = filteredPackages.map((item) => [
      item.status === "received" ? "受取済み" : "未受取",
      item.staffs?.staff_name ?? "",
      item.staffs?.department ?? "",
      item.shipper_name ?? "",
      item.carriers?.name ?? "",
      item.quantity,
      getLocationText(item),
      new Date(item.arrived_at).toLocaleString("ja-JP"),
      `${getElapsedDays(item.arrived_at)}日`,
      item.received_by ?? "",
      item.received_at
        ? new Date(item.received_at).toLocaleString("ja-JP")
        : "",
      item.staffs?.email ?? "",
      item.staffs?.group_email ?? "",
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((value) => escapeCsv(value)).join(","))
      .join("\n");

    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `tenant_packages_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();

    URL.revokeObjectURL(url);
  };

  const groupedByDepartment = useMemo(() => {
    const map = new Map<string, PackageRow[]>();

    filteredPackages.forEach((item) => {
      const department = item.staffs?.department ?? "未分類";

      if (!map.has(department)) {
        map.set(department, []);
      }

      map.get(department)!.push(item);
    });

    return Array.from(map.entries());
  }, [filteredPackages]);

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between rounded-2xl bg-white p-6 shadow">
          <div>
            <h1 className="text-2xl font-bold">到着状況一覧</h1>
            <p className="text-sm text-gray-500">
              自社スタッフ宛の荷物を確認・受取処理できます。
            </p>
          </div>

          <button
            onClick={() => router.push("/tenant/home")}
            className="rounded-lg bg-black px-4 py-2 text-white"
          >
            テナント画面へ戻る
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">未受取件数</p>
            <p className="mt-2 text-3xl font-bold">
              {unreceivedPackages.length}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">受取済み件数</p>
            <p className="mt-2 text-3xl font-bold">
              {receivedPackages.length}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">5日超過</p>
            <p className="mt-2 text-3xl font-bold text-red-600">
              {alertPackages.length}
            </p>
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
          </div>
        )}

        <div className="rounded-2xl bg-white p-6 shadow">
          <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-xl font-bold">絞り込み</h2>
              <p className="text-sm text-gray-500">
                表示件数：{filteredPackages.length}件 / 表示個数：
                {filteredQuantity}個
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div>
                <label className="mb-1 block text-sm font-bold">状態</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full rounded-lg border p-3"
                >
                  <option value="unreceived">未受取</option>
                  <option value="received">受取済み</option>
                  <option value="all">すべて</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold">到着日</label>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full rounded-lg border p-3"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold">検索</label>
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="スタッフ・部署・荷主など"
                  className="w-full rounded-lg border p-3"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={exportCsv}
                  className="w-full rounded-lg bg-green-600 px-4 py-3 font-bold text-white"
                >
                  CSV出力
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setStatusFilter("unreceived");
              setDateFilter("");
              setKeyword("");
            }}
            className="rounded-lg border px-4 py-2"
          >
            フィルター解除
          </button>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-bold">荷物一覧</h2>

          {loading ? (
            <p>読み込み中...</p>
          ) : filteredPackages.length === 0 ? (
            <p className="text-gray-500">表示対象の荷物はありません。</p>
          ) : (
            <div className="space-y-8">
              {groupedByDepartment.map(([department, items]) => {
                const departmentQuantity = items.reduce(
                  (sum, item) => sum + item.quantity,
                  0
                );

                return (
                  <div key={department} className="rounded-2xl border p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-bold">{department}</h3>
                        <p className="text-sm text-gray-500">
                          表示件数：{items.length}件
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
                            <th className="p-3">状態</th>
                            <th className="p-3">宛先スタッフ</th>
                            <th className="p-3">荷主</th>
                            <th className="p-3">配送業者</th>
                            <th className="p-3">個数</th>
                            <th className="p-3">保管場所</th>
                            <th className="p-3">到着日時</th>
                            <th className="p-3">経過</th>
                            <th className="p-3">受取者</th>
                            <th className="p-3">受取日時</th>
                            <th className="p-3">操作</th>
                          </tr>
                        </thead>

                        <tbody>
                          {items.map((item) => {
                            const days = getElapsedDays(item.arrived_at);
                            const isAlert =
                              item.status === "unreceived" && days >= 5;

                            return (
                              <tr
                                key={item.id}
                                className={`border-b ${
                                  isAlert ? "bg-red-50" : ""
                                }`}
                              >
                                <td className="p-3">
                                  {item.status === "received"
                                    ? "受取済み"
                                    : "未受取"}
                                </td>

                                <td className="p-3 font-bold">
                                  {item.staffs?.staff_name ?? "未設定"}
                                </td>

                                <td className="p-3">
                                  {item.shipper_name ?? "-"}
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
                                      isAlert
                                        ? "bg-red-100 text-red-700"
                                        : "bg-gray-100 text-gray-600"
                                    }`}
                                  >
                                    {days}日
                                  </span>
                                </td>

                                <td className="p-3">
                                  {item.received_by ?? "-"}
                                </td>

                                <td className="p-3">
                                  {item.received_at
                                    ? new Date(
                                        item.received_at
                                      ).toLocaleString("ja-JP")
                                    : "-"}
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
                                    <button
                                      onClick={() =>
                                        handleReturnUnreceived(item.id)
                                      }
                                      className="rounded bg-gray-600 px-3 py-1 text-white"
                                    >
                                      未受取に戻す
                                    </button>
                                  )}
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
      </div>
    </main>
  );
}