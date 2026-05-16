"use client";

import { DragEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Company = {
  id: string;
  name: string;
};

type Staff = {
  id: string;
  company_id: string;
  staff_name: string;
  department: string | null;
};

type Location = {
  id: string;
  code: string;
  name: string | null;
};

type DepartmentLocation = {
  id: string;
  company_id: string;
  department: string;
  location_id: string;
  locations: Location | null;
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

export default function AdminDepartmentLocationsPage() {
  const router = useRouter();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [departmentLocations, setDepartmentLocations] = useState<
    DepartmentLocation[]
  >([]);

  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedLocationCode, setSelectedLocationCode] = useState("");
  const [draggingDepartment, setDraggingDepartment] = useState("");
  const [hoverLocationCode, setHoverLocationCode] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);

    const { data: companyData, error: companyError } = await supabase
      .from("companies")
      .select("id, name")
      .order("name");

    if (companyError) {
      alert("会社取得エラー：" + companyError.message);
      setLoading(false);
      return;
    }

    const { data: locationData, error: locationError } = await supabase
      .from("locations")
      .select("id, code, name")
      .order("code");

    if (locationError) {
      alert("ロケーション取得エラー：" + locationError.message);
      setLoading(false);
      return;
    }

    const { data: relationData, error: relationError } = await supabase
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
      `);

    if (relationError) {
      alert("部署ロケーション取得エラー：" + relationError.message);
      setLoading(false);
      return;
    }

    const { data: staffData, error: staffError } = await supabase
      .from("staffs")
      .select("id, company_id, staff_name, department")
      .eq("is_active", true)
      .order("department")
      .order("staff_name");

    if (staffError) {
      alert("スタッフ取得エラー：" + staffError.message);
      setLoading(false);
      return;
    }

    const companyList = (companyData ?? []) as Company[];

    setCompanies(companyList);
    setLocations((locationData ?? []) as Location[]);
    setDepartmentLocations(
      (relationData ?? []) as unknown as DepartmentLocation[]
    );
    setStaffs((staffData ?? []) as Staff[]);

    if (!selectedCompanyId && companyList.length > 0) {
      setSelectedCompanyId(companyList[0].id);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const selectedCompany = companies.find(
    (company) => company.id === selectedCompanyId
  );

  const companyStaffs = useMemo(() => {
    return staffs.filter((staff) => staff.company_id === selectedCompanyId);
  }, [staffs, selectedCompanyId]);

  const departments = useMemo(() => {
    const map = new Map<string, number>();

    companyStaffs.forEach((staff) => {
      const department = staff.department || "未分類";
      map.set(department, (map.get(department) ?? 0) + 1);
    });

    return Array.from(map.entries()).map(([department, count]) => ({
      department,
      count,
    }));
  }, [companyStaffs]);

  const getAssignedLocation = (department: string) => {
    return departmentLocations.find(
      (item) =>
        item.company_id === selectedCompanyId &&
        item.department === department
    );
  };

  const getLocationByCode = (code: string) => {
    return locations.find((location) => location.code === code);
  };

  const getAssignedDepartmentsByLocation = (locationCode: string) => {
    return departmentLocations.filter(
      (item) =>
        item.company_id === selectedCompanyId &&
        item.locations?.code === locationCode
    );
  };

  const assignDepartmentToLocation = async (
  department: string,
  locationCode: string
) => {
  if (!selectedCompanyId) {
    alert("会社を選択してください。");
    return;
  }

  if (!department) {
    alert("部署を選択してください。");
    return;
  }

  const location = getLocationByCode(locationCode);

  if (!location) {
    alert("ロケーションが見つかりません。");
    return;
  }

  const ok = confirm(
    `${selectedCompany?.name ?? ""} / ${department} を ${locationCode} に割り当てますか？`
  );

  if (!ok) {
    setDraggingDepartment("");
    setHoverLocationCode("");
    return;
  }

  const { error } = await supabase
    .from("department_locations")
    .upsert(
      {
        company_id: selectedCompanyId,
        department,
        location_id: location.id,
      },
      {
        onConflict: "company_id,department",
      }
    );

  if (error) {
    alert("割当登録エラー：" + error.message);
    return;
  }

  setSelectedDepartment("");
  setSelectedLocationCode(locationCode);
  setDraggingDepartment("");
  setHoverLocationCode("");

  await fetchData();
};
  const unassignDepartment = async (department: string) => {
    const ok = confirm(`${department} のロケーション割当を解除しますか？`);

    if (!ok) return;

    const { error } = await supabase
      .from("department_locations")
      .delete()
      .eq("company_id", selectedCompanyId)
      .eq("department", department);

    if (error) {
      alert("解除エラー：" + error.message);
      return;
    }

    await fetchData();
  };

  const handleDepartmentDragStart = (
    event: DragEvent<HTMLDivElement>,
    department: string
  ) => {
    setDraggingDepartment(department);
    setSelectedDepartment(department);

    event.dataTransfer.clearData();
    event.dataTransfer.setData("text/plain", department);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDepartmentDragEnd = () => {
    setDraggingDepartment("");
    setHoverLocationCode("");
  };

  const handleLocationDragOver = (
    event: DragEvent<HTMLDivElement>,
    locationCode: string
  ) => {
    event.preventDefault();
    event.stopPropagation();

    event.dataTransfer.dropEffect = "move";
    setHoverLocationCode(locationCode);
  };

  const handleLocationDrop = async (
    event: DragEvent<HTMLDivElement>,
    locationCode: string
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const droppedDepartment =
      event.dataTransfer.getData("text/plain") ||
      draggingDepartment ||
      selectedDepartment;

    setHoverLocationCode("");

    if (!droppedDepartment) {
      alert("部署チップをドラッグしてください。");
      return;
    }

    await assignDepartmentToLocation(droppedDepartment, locationCode);
  };

  const handleLocationClick = async (locationCode: string) => {
    setSelectedLocationCode(locationCode);

    if (selectedDepartment) {
      await assignDepartmentToLocation(selectedDepartment, locationCode);
    }
  };

  const selectedLocationDepartments = selectedLocationCode
    ? getAssignedDepartmentsByLocation(selectedLocationCode)
    : [];

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              ロケーション設定
            </h1>
            <p className="text-sm text-slate-500">
              会社を選択し、部署チップをロケーションへドラッグ＆ドロップして保管場所を設定します。
            </p>
          </div>

          <button
            onClick={() => router.push("/home")}
            className="rounded-xl bg-slate-900 px-4 py-2 font-bold text-white"
          >
            管理画面へ戻る
          </button>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <label className="mb-2 block text-sm font-bold text-slate-700">
            会社選択
          </label>

          <select
            value={selectedCompanyId}
            onChange={(e) => {
              setSelectedCompanyId(e.target.value);
              setSelectedDepartment("");
              setSelectedLocationCode("");
              setDraggingDepartment("");
              setHoverLocationCode("");
            }}
            className="w-full rounded-xl border border-slate-200 p-3"
          >
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">部署一覧</h2>
              <p className="text-sm text-slate-500">
                部署チップを掴んで、下のマップへドロップしてください。
              </p>
            </div>

            {selectedCompany && (
              <div className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700">
                {selectedCompany.name}
              </div>
            )}
          </div>

          {loading ? (
            <p className="text-slate-500">読み込み中...</p>
          ) : departments.length === 0 ? (
            <p className="text-slate-500">部署がありません。</p>
          ) : (
            <div className="flex max-h-40 flex-wrap gap-3 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {departments.map((item) => {
                const assigned = getAssignedLocation(item.department);
                const isSelected = selectedDepartment === item.department;
                const isDragging = draggingDepartment === item.department;

                return (
                  <div
                    key={item.department}
                    draggable
                    onDragStart={(event) =>
                      handleDepartmentDragStart(event, item.department)
                    }
                    onDragEnd={handleDepartmentDragEnd}
                    onClick={() => setSelectedDepartment(item.department)}
                    className={`flex cursor-grab select-none items-center gap-3 rounded-full border px-4 py-3 text-sm shadow-sm transition active:cursor-grabbing ${
                      isSelected
                        ? "border-blue-600 bg-blue-50"
                        : "border-slate-200 bg-white hover:bg-slate-100"
                    } ${isDragging ? "opacity-50" : ""}`}
                  >
                    <div>
                      <p className="font-bold text-slate-900">
                        {item.department}
                      </p>
                      <p className="text-xs text-slate-500">
                        {item.count}名
                      </p>
                    </div>

                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                      {assigned?.locations?.code ?? "未設定"}
                    </span>

                    {assigned?.locations && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          unassignDepartment(item.department);
                        }}
                        className="rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-700"
                      >
                        解除
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                保管ロケーションマップ
              </h2>
              <p className="text-sm text-slate-500">
                選択中の部署：
                <span className="font-bold text-blue-700">
                  {selectedDepartment || "未選択"}
                </span>
              </p>
            </div>

            <div className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700">
              選択中ロケーション：{selectedLocationCode || "未選択"}
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
            <div className="relative h-[650px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
              <div className="absolute left-6 top-6 z-10 rounded-xl bg-white px-4 py-2 text-sm font-bold shadow-sm">
                荷捌き場 / 保管エリア
              </div>

              <div className="absolute left-[16%] top-[34%] h-[42%] w-[34%] rounded-2xl border-2 border-dashed border-slate-300 bg-white/40" />
              <div className="absolute left-[48%] top-[72%] h-[16%] w-[34%] rounded-2xl border-2 border-dashed border-slate-300 bg-white/40" />
              <div className="absolute left-[76%] top-[22%] h-[42%] w-[14%] rounded-2xl border-2 border-dashed border-slate-300 bg-white/40" />

              {layoutLocations.map((layout) => {
                const assignedDepartments =
                  getAssignedDepartmentsByLocation(layout.code);

                const isSelected = selectedLocationCode === layout.code;
                const isHover = hoverLocationCode === layout.code;

                return (
                  <div
                    key={layout.code}
                    onDragOver={(event) =>
                      handleLocationDragOver(event, layout.code)
                    }
                    onDragEnter={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setHoverLocationCode(layout.code);
                    }}
                    onDragLeave={() => setHoverLocationCode("")}
                    onDrop={(event) => handleLocationDrop(event, layout.code)}
                    onClick={() => handleLocationClick(layout.code)}
                    className={`absolute flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 cursor-pointer flex-col items-center justify-center rounded-xl border-2 text-sm font-bold shadow-sm transition hover:scale-105 ${
                      isHover
                        ? "border-green-700 bg-green-500 text-white"
                        : isSelected
                          ? "border-blue-800 bg-blue-700 text-white"
                          : assignedDepartments.length > 0
                            ? "border-blue-600 bg-blue-500 text-white"
                            : "border-slate-300 bg-white text-slate-900"
                    }`}
                    style={{
                      left: `${layout.x}%`,
                      top: `${layout.y}%`,
                    }}
                  >
                    <span>{layout.code}</span>

                    {assignedDepartments.length > 0 && (
                      <span className="mt-1 text-[10px]">
                        {assignedDepartments.length}部署
                      </span>
                    )}
                  </div>
                );
              })}

              <div className="absolute bottom-6 left-6 rounded-xl bg-white px-4 py-2 text-xs text-slate-500 shadow-sm">
                ※ 青色：部署割当あり / 緑色：ドロップ先
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-5">
              <h3 className="font-bold text-slate-900">
                選択中ロケーション
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                {selectedLocationCode || "未選択"}
              </p>

              <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-2">
                {!selectedLocationCode ? (
                  <p className="text-sm text-slate-500">
                    ロケーションをクリックしてください。
                  </p>
                ) : selectedLocationDepartments.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    このロケーションに割当された部署はありません。
                  </p>
                ) : (
                  selectedLocationDepartments.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
                    >
                      <div>
                        <p className="font-bold text-slate-900">
                          {item.department}
                        </p>
                        <p className="text-xs text-slate-500">
                          {selectedCompany?.name ?? "-"}
                        </p>
                      </div>

                      <button
                        onClick={() => unassignDepartment(item.department)}
                        className="rounded-lg bg-red-50 px-3 py-1 text-xs font-bold text-red-700"
                      >
                        解除
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}