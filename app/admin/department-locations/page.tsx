"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Staff = {
  id: string;
  company_id: string;
  name: string;
  department: string | null;
};

type Location = {
  id: string;
  code: string;
  name: string | null;
  map_x: number | null;
  map_y: number | null;
};

type DepartmentLocation = {
  id: string;
  company_id: string;
  department: string;
  location_id: string;
};

export default function DepartmentLocationsPage() {
  const router = useRouter();

  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [departmentLocations, setDepartmentLocations] = useState<
    DepartmentLocation[]
  >([]);

  const [draggingDepartment, setDraggingDepartment] = useState<string | null>(
    null
  );

  const fetchData = async () => {
    const { data: staffs } = await supabase
      .from("profiles")
      .select("id, company_id, name, department")
      .order("department")
      .order("name");

    const { data: locationData } = await supabase
      .from("locations")
      .select("id, code, name, map_x, map_y")
      .order("code");

    const { data: departmentLocationData } = await supabase
      .from("department_locations")
      .select("id, company_id, department, location_id");

    setStaffList((staffs ?? []) as Staff[]);
    setLocations((locationData ?? []) as Location[]);
    setDepartmentLocations(
      (departmentLocationData ?? []) as DepartmentLocation[]
    );
  };

  useEffect(() => {
    fetchData();
  }, []);

  const departments = useMemo(() => {
    const map = new Map<
      string,
      {
        department: string;
        company_id: string;
        count: number;
      }
    >();

    staffList.forEach((staff) => {
      const department = staff.department || "未分類";

      if (!map.has(department)) {
        map.set(department, {
          department,
          company_id: staff.company_id,
          count: 1,
        });
      } else {
        const current = map.get(department)!;
        current.count += 1;
      }
    });

    return Array.from(map.values());
  }, [staffList]);

  const getAssignedDepartment = (locationId: string) => {
    const assignment = departmentLocations.find(
      (item) => item.location_id === locationId
    );

    return assignment?.department ?? null;
  };

  const handleDrop = async (location: Location) => {
    if (!draggingDepartment) return;

    const department = departments.find(
      (item) => item.department === draggingDepartment
    );

    if (!department) return;

    const existing = departmentLocations.find(
      (item) =>
        item.company_id === department.company_id &&
        item.department === department.department
    );

    if (existing) {
      const { error } = await supabase
        .from("department_locations")
        .update({
          location_id: location.id,
        })
        .eq("id", existing.id);

      if (error) {
        alert("更新エラー：" + error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("department_locations").insert({
        company_id: department.company_id,
        department: department.department,
        location_id: location.id,
      });

      if (error) {
        alert("登録エラー：" + error.message);
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
            <h1 className="text-2xl font-bold">部署ロケーション設定</h1>
            <p className="text-sm text-gray-500">
              部署カードをロケーションにドラッグ＆ドロップして、保管場所を設定します。
            </p>
          </div>

          <button
            onClick={() => router.push("/home")}
            className="rounded-lg bg-black px-4 py-2 text-white"
          >
            ホームへ戻る
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="rounded-2xl bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-bold">部署一覧</h2>

            {departments.length === 0 ? (
              <p className="text-sm text-gray-500">部署がありません。</p>
            ) : (
              <div className="space-y-3">
                {departments.map((department) => (
                  <div
                    key={department.department}
                    draggable
                    onDragStart={() =>
                      setDraggingDepartment(department.department)
                    }
                    onDragEnd={() => setDraggingDepartment(null)}
                    className="cursor-grab rounded-xl border bg-white p-4 shadow-sm active:cursor-grabbing"
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

          <div className="rounded-2xl bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-bold">保管ロケーションマップ</h2>

            <div className="relative h-[520px] overflow-hidden rounded-2xl border bg-slate-100">
              <div className="absolute left-6 top-6 rounded-lg bg-white px-3 py-2 text-sm font-bold shadow">
                荷捌き場 / 保管エリア
              </div>

              <div className="absolute left-[8%] top-[20%] h-[60%] w-[22%] rounded-xl border-2 border-dashed border-gray-400 bg-white/50" />
              <div className="absolute left-[39%] top-[20%] h-[60%] w-[22%] rounded-xl border-2 border-dashed border-gray-400 bg-white/50" />
              <div className="absolute left-[70%] top-[20%] h-[60%] w-[22%] rounded-xl border-2 border-dashed border-gray-400 bg-white/50" />

              {locations.map((location) => {
                const assignedDepartment = getAssignedDepartment(location.id);

                return (
                  <div
                    key={location.id}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(location)}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: `${location.map_x ?? 50}%`,
                      top: `${location.map_y ?? 50}%`,
                    }}
                  >
                    <div className="min-w-32 rounded-xl bg-blue-600 px-4 py-3 text-center text-white shadow-lg">
                      <p className="text-lg font-bold">{location.code}</p>
                      <p className="text-xs">{location.name ?? ""}</p>
                    </div>

                    {assignedDepartment && (
                      <div className="mt-2 rounded-xl bg-white px-3 py-2 text-center text-sm font-bold shadow">
                        {assignedDepartment}
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="absolute bottom-6 left-6 rounded-lg bg-white px-3 py-2 text-xs text-gray-500 shadow">
                部署カードをロケーションへドロップ
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}