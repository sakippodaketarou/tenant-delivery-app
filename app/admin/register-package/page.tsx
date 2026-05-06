"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Carrier = {
  id: string;
  name: string;
  barcode_value: string;
};

type Profile = {
  id: string;
  company_id: string;
  name: string;
  department: string | null;
  qr_value: string | null;
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

type ScanItem = {
  recipient: Profile;
  location: {
    id: string;
    code: string;
    name: string | null;
  };
  quantity: number;
};

export default function RegisterPackagePage() {
  const carrierInputRef = useRef<HTMLInputElement>(null);
  const staffInputRef = useRef<HTMLInputElement>(null);

  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [departmentLocations, setDepartmentLocations] = useState<
    DepartmentLocation[]
  >([]);

  const [selectedCarrier, setSelectedCarrier] = useState<Carrier | null>(null);
  const [carrierScan, setCarrierScan] = useState("");
  const [staffScan, setStaffScan] = useState("");

  const [items, setItems] = useState<ScanItem[]>([]);

  useEffect(() => {
    fetchMasters();
    setTimeout(() => carrierInputRef.current?.focus(), 300);
  }, []);

  const fetchMasters = async () => {
    const { data: carrierData } = await supabase
      .from("carriers")
      .select("id, name, barcode_value")
      .order("name");

    const { data: profileData } = await supabase
      .from("profiles")
      .select("id, company_id, name, department, qr_value")
      .order("name");

    const { data: departmentLocationData } = await supabase
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

    setCarriers(carrierData ?? []);
    setProfiles(profileData ?? []);
    setDepartmentLocations(
      (departmentLocationData ?? []) as unknown as DepartmentLocation[]
    );
  };

  const handleCarrierScan = () => {
    const value = carrierScan.trim();
    if (!value) return;

    const carrier = carriers.find((c) => c.barcode_value === value);

    if (!carrier) {
      alert("配送会社QRが見つかりません：" + value);
      setCarrierScan("");
      return;
    }

    setSelectedCarrier(carrier);
    setCarrierScan("");
    setTimeout(() => staffInputRef.current?.focus(), 100);
  };

  const handleStaffScan = () => {
    if (!selectedCarrier) {
      alert("先に配送会社QRを読み取ってください。");
      setStaffScan("");
      setTimeout(() => carrierInputRef.current?.focus(), 100);
      return;
    }

    const value = staffScan.trim();
    if (!value) return;

    const recipient = profiles.find((p) => p.qr_value === value);

    if (!recipient) {
      alert("スタッフQRが見つかりません：" + value);
      setStaffScan("");
      return;
    }

    if (!recipient.department) {
      alert(`${recipient.name} さんの部署が未設定です。`);
      setStaffScan("");
      return;
    }

    const departmentLocation = departmentLocations.find(
      (item) =>
        item.company_id === recipient.company_id &&
        item.department === recipient.department
    );

    if (!departmentLocation?.locations) {
      alert(
        `${recipient.department} の保管ロケーションが未設定です。\n先に部署ロケーションを設定してください。`
      );
      setStaffScan("");
      return;
    }

    const location = departmentLocation.locations;

    setItems((prev) => {
      const existingIndex = prev.findIndex(
        (item) =>
          item.recipient.id === recipient.id &&
          item.location.id === location.id
      );

      if (existingIndex >= 0) {
        return prev.map((item, index) =>
          index === existingIndex
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [
        ...prev,
        {
          recipient,
          location,
          quantity: 1,
        },
      ];
    });

    setStaffScan("");
    setTimeout(() => staffInputRef.current?.focus(), 100);
  };

  const resetCarrier = () => {
    if (items.length > 0) {
      const ok = confirm(
        "配送会社を変更すると、現在の読み取りリストがリセットされます。よろしいですか？"
      );

      if (!ok) return;
    }

    setSelectedCarrier(null);
    setCarrierScan("");
    setStaffScan("");
    setItems([]);
    setTimeout(() => carrierInputRef.current?.focus(), 100);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleComplete = async () => {
    if (!selectedCarrier) {
      alert("配送会社が未選択です。");
      return;
    }

    if (items.length === 0) {
      alert("登録する荷物がありません。");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      alert("ログインしてください。");
      return;
    }

    const insertRows = items.map((item) => ({
      company_id: item.recipient.company_id,
      recipient_user_id: item.recipient.id,
      carrier_id: selectedCarrier.id,
      location_id: item.location.id,
      quantity: item.quantity,
      status: "unreceived",
      registered_by: user.id,
    }));

    const { error } = await supabase.from("packages").insert(insertRows);

    if (error) {
      alert("登録エラー：" + error.message);
      return;
    }

    alert("作業完了！荷物を一括登録しました。");

    setItems([]);
    setSelectedCarrier(null);
    setCarrierScan("");
    setStaffScan("");

    await fetchMasters();

    setTimeout(() => carrierInputRef.current?.focus(), 100);
  };

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-2xl bg-white p-6 shadow">
          <h1 className="text-2xl font-bold">荷捌き場 荷物登録</h1>
          <p className="mt-1 text-sm text-gray-500">
            配送会社QRを最初に1回読み取り、その後はスタッフQRだけを読み取ります。
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <p className="mb-2 text-sm font-bold">① 配送会社QR</p>

          {selectedCarrier ? (
            <div className="flex items-center justify-between rounded-xl border bg-gray-50 p-4">
              <div>
                <p className="text-sm text-gray-500">現在の配送会社</p>
                <p className="text-2xl font-bold">{selectedCarrier.name}</p>
              </div>

              <button
                onClick={resetCarrier}
                className="rounded-lg bg-red-600 px-4 py-2 text-white"
              >
                配送会社を変更
              </button>
            </div>
          ) : (
            <input
              ref={carrierInputRef}
              value={carrierScan}
              onChange={(e) => setCarrierScan(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCarrierScan();
              }}
              placeholder="配送会社QRを読み取り"
              className="w-full rounded border p-3"
            />
          )}
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <p className="mb-2 text-sm font-bold">② スタッフQR</p>

          <input
            ref={staffInputRef}
            value={staffScan}
            onChange={(e) => setStaffScan(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleStaffScan();
            }}
            placeholder="スタッフQRを読み取り"
            disabled={!selectedCarrier}
            className="w-full rounded border p-3 disabled:bg-gray-200"
          />

          <p className="mt-3 text-sm text-gray-500">
            スタッフの部署に設定された保管ロケーションへ自動登録されます。
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">今回登録する荷物</h2>
              <p className="text-sm text-gray-500">
                配送会社：{selectedCarrier?.name ?? "未選択"}
              </p>
            </div>

            <button
              onClick={handleComplete}
              disabled={!selectedCarrier || items.length === 0}
              className="rounded-lg bg-black px-5 py-2 text-white disabled:bg-gray-400"
            >
              作業完了・一括登録
            </button>
          </div>

          {items.length === 0 ? (
            <p className="text-gray-500">
              まだスタッフQRが読み取られていません。
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="p-3">宛先スタッフ</th>
                  <th className="p-3">部署</th>
                  <th className="p-3">自動ロケーション</th>
                  <th className="p-3">個数</th>
                  <th className="p-3">操作</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item, index) => (
                  <tr
                    key={`${item.recipient.id}-${item.location.id}`}
                    className="border-b"
                  >
                    <td className="p-3 font-bold">{item.recipient.name}</td>
                    <td className="p-3">{item.recipient.department ?? "-"}</td>
                    <td className="p-3">
                      {item.location.code}
                      {item.location.name && (
                        <span className="ml-2 text-xs text-gray-500">
                          {item.location.name}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-lg font-bold">{item.quantity}</td>
                    <td className="p-3">
                      <button
                        onClick={() => removeItem(index)}
                        className="rounded bg-red-600 px-3 py-1 text-white"
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-2 font-bold">テスト用QR値</h2>
          <p className="text-sm text-gray-600">
            配送会社：CARRIER_YAMATO / CARRIER_SAGAWA / CARRIER_JAPANPOST
          </p>
          <p className="text-sm text-gray-600">
            スタッフ例：TENANT_KUDO_ADMIN / STAFF_CHIKAMI
          </p>
        </div>
      </div>
    </main>
  );
}