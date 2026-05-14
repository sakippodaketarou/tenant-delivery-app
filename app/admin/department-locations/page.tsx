"use client";

import { useEffect, useMemo, useState } from "react";
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

    const location = getLocationByCode(locationCode);

    if (!location) {
      alert("ロケーションが見つかりません。");
      return;
    }

    const ok = confirm(
      `${selectedCompany?.name ?? ""} / ${department} を ${locationCode} に割り当てますか？`
    );

    if (!ok) return;

    const { error: deleteError } = await supabase
      .from("department_locations")
      .delete()
      .eq("company_id", selectedCompanyId)
      .eq("department", department);

    if (deleteError) {
      alert("既存割当削除エラー：" + deleteError.message);
      return;
    }

    const { error: insertError } = await supabase
      .from("department_locations")
      .insert({
        company_id: selectedCompanyId,
        department,
        location_id: location.id,
      });

    if (insertError) {
      alert("割当登録エラー：" + insertError.message);
      return;
    }

    setSelectedDepartment("");
    setSelectedLocationCode("");
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

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              ロケーション設定
            </h1>
            <p className="text-sm text-slate-500">
              会社を選択し、部署ごとの保管ロケーションを設定します。
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

        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">部署一覧</h2>
            <p className="mt-1 text-sm text-slate-500">
              部署を選択してから、右のロケーションをクリックしてください。
            </p>

            <div className="mt-5 max-h-[620px] space-y-3 overflow-y-auto pr-2">
              {loading ? (
                <p className="text-slate-500">読み込み中...</p>
              ) : departments.length === 0 ? (
                <p className="text-slate-500">部署がありません。</p>
              ) : (
                departments.map((item) => {
                  const assigned = getAssignedLocation(item.department);

                  return (
                    <button
                      key={item.department}
                      onClick={() => setSelectedDepartment(item.department)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        selectedDepartment === item.department
                          ? "border-blue-600 bg-blue-50"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-bold text-slate-900">
                            {item.department}
                          </p>
                          <p className="text-sm text-slate-500">
                            {item.count}名
                          </p>
                        </div>

                        {assigned?.locations && (
                          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
                            {assigned.locations.code}
                          </span>
                        )}
                      </div>

                      {assigned?.locations && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            unassignDepartment(item.department);
                          }}
                          className="mt-3 rounded-lg bg-red-50 px-3 py-1 text-xs font-bold text-red-700"
                        >
                          割当解除
                        </button>
                      )}
                    </button>
                  );
                })
              )}
            </div>
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

              {selectedCompany && (
                <div className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700">
                  {selectedCompany.name}
                </div>
              )}
            </div>

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

                return (
                  <div
                    key={layout.code}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: `${layout.x}%`,
                      top: `${layout.y}%`,
                    }}
                  >
                    <button
                      onClick={() => {
                        setSelectedLocationCode(layout.code);

                        if (selectedDepartment) {
                          assignDepartmentToLocation(
                            selectedDepartment,
                            layout.code
                          );
                        }
                      }}
                      className={`flex h-16 w-16 flex-col items-center justify-center rounded-xl border-2 text-sm font-bold shadow-sm transition hover:scale-105 ${
                        isSelected
                          ? "border-blue-800 bg-blue-700 text-white"
                          : assignedDepartments.length > 0
                            ? "border-blue-600 bg-blue-500 text-white"
                            : "border-slate-300 bg-white text-slate-900"
                      }`}
                    >
                      <span>{layout.code}</span>
                      {assignedDepartments.length > 0 && (
                        <span className="mt-1 text-[10px]">
                          {assignedDepartments.length}部署
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}

              <div className="absolute bottom-6 left-6 rounded-xl bg-white px-4 py-2 text-xs text-slate-500 shadow-sm">
                ※ 青色：部署割当あり
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 p-5">
              <h3 className="font-bold text-slate-900">
                選択中ロケーション
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                {selectedLocationCode || "未選択"}
              </p>

              <div className="mt-4 max-h-48 space-y-2 overflow-y-auto pr-2">
                {!selectedLocationCode ? (
                  <p className="text-sm text-slate-500">
                    ロケーションをクリックしてください。
                  </p>
                ) : getAssignedDepartmentsByLocation(selectedLocationCode)
                    .length === 0 ? (
                  <p className="text-sm text-slate-500">
                    このロケーションに割当された部署はありません。
                  </p>
                ) : (
                  getAssignedDepartmentsByLocation(selectedLocationCode).map(
                    (item) => (
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
                    )
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}