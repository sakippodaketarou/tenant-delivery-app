"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Carrier = {
  id: string;
  name: string;
  barcode_value: string;
};

type Staff = {
  id: string;
  company_id: string;
  staff_name: string;
  department: string | null;
  email: string | null;
  group_email: string | null;
  qr_value: string | null;
  companies?: {
    name: string;
  } | null;
};

type ScannedItem = {
  staff: Staff;
  quantity: number;
};

export default function RegisterPackagePage() {
  const router = useRouter();

  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [selectedCarrier, setSelectedCarrier] = useState<Carrier | null>(null);

  const [carrierQr, setCarrierQr] = useState("");
  const [staffQr, setStaffQr] = useState("");

  const [items, setItems] = useState<ScannedItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCarriers = async () => {
    const { data, error } = await supabase
      .from("carriers")
      .select("id, name, barcode_value")
      .order("name");

    if (error) {
      alert("配送会社取得エラー：" + error.message);
      return;
    }

    setCarriers((data ?? []) as Carrier[]);
  };

  useEffect(() => {
    fetchCarriers();
  }, []);

  const handleCarrierQr = () => {
    const value = carrierQr.trim();

    if (!value) {
      alert("配送会社QRを入力してください。");
      return;
    }

    const carrier = carriers.find((item) => item.barcode_value === value);

    if (!carrier) {
      alert("配送会社が見つかりません。");
      return;
    }

    setSelectedCarrier(carrier);
    setCarrierQr("");
  };

  const handleStaffQr = async () => {
    if (!selectedCarrier) {
      alert("先に配送会社QRを読み取ってください。");
      return;
    }

    const value = staffQr.trim();

    if (!value) {
      alert("スタッフQRを入力してください。");
      return;
    }

    const { data, error } = await supabase
      .from("staffs")
      .select(`
        id,
        company_id,
        staff_name,
        department,
        email,
        group_email,
        qr_value,
        companies (
          name
        )
      `)
      .eq("qr_value", value)
      .eq("is_active", true)
      .single();

    if (error || !data) {
      alert("スタッフが見つかりません。");
      return;
    }

    const staff = data as unknown as Staff;

    setItems((prev) => {
      const existing = prev.find((item) => item.staff.id === staff.id);

      if (existing) {
        return prev.map((item) =>
          item.staff.id === staff.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...prev, { staff, quantity: 1 }];
    });

    setStaffQr("");
  };

  const changeQuantity = (staffId: string, quantity: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.staff.id === staffId
          ? { ...item, quantity: Math.max(1, quantity) }
          : item
      )
    );
  };

  const removeItem = (staffId: string) => {
    setItems((prev) => prev.filter((item) => item.staff.id !== staffId));
  };

  const sendArrivalMail = async (item: ScannedItem) => {
    await fetch("/api/send-arrival-mail", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: item.staff.email,
        groupEmail: item.staff.group_email,
        companyName: item.staff.companies?.name ?? "-",
        staffName: item.staff.staff_name,
        department: item.staff.department ?? "-",
        carrierName: selectedCarrier?.name ?? "-",
        quantity: item.quantity,
        location: "部署ごとの保管ロケーション",
      }),
    });
  };

  const handleRegister = async () => {
    if (!selectedCarrier) {
      alert("配送会社が未選択です。");
      return;
    }

    if (items.length === 0) {
      alert("登録する荷物がありません。");
      return;
    }

    const ok = confirm(`${items.length}名分の荷物を登録しますか？`);

    if (!ok) return;

    setLoading(true);

    const insertRows = items.map((item) => ({
      company_id: item.staff.company_id,
      carrier_id: selectedCarrier.id,
      recipient_staff_id: item.staff.id,
      quantity: item.quantity,
      status: "unreceived",
      arrived_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from("packages").insert(insertRows);

    if (error) {
      setLoading(false);
      alert("荷物登録エラー：" + error.message);
      return;
    }

    for (const item of items) {
      await sendArrivalMail(item);
    }

    setLoading(false);
    alert("荷物登録とメール通知が完了しました。");

    setSelectedCarrier(null);
    setItems([]);
    setCarrierQr("");
    setStaffQr("");
  };

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between rounded-2xl bg-white p-6 shadow">
          <div>
            <h1 className="text-2xl font-bold">荷捌き場 荷物登録</h1>
            <p className="text-sm text-gray-500">
              配送会社QRを最初に読み取り、その後スタッフQRだけを読み取ります。
            </p>
          </div>

          <button
            onClick={() => router.push("/home")}
            className="rounded-lg bg-black px-4 py-2 text-white"
          >
            ホームへ戻る
          </button>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <label className="mb-2 block font-bold">① 配送会社QR</label>

          {selectedCarrier ? (
            <div className="flex items-center justify-between rounded-xl border p-4">
              <div>
                <p className="text-sm text-gray-500">現在の配送会社</p>
                <p className="text-xl font-bold">{selectedCarrier.name}</p>
              </div>

              <button
                onClick={() => setSelectedCarrier(null)}
                className="rounded-lg bg-red-600 px-4 py-2 text-white"
              >
                配送会社を変更
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <input
                value={carrierQr}
                onChange={(e) => setCarrierQr(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCarrierQr();
                }}
                placeholder="配送会社QRを読み取り"
                className="flex-1 rounded-lg border p-3"
                autoFocus
              />

              <button
                onClick={handleCarrierQr}
                className="rounded-lg bg-blue-600 px-5 py-2 text-white"
              >
                読取
              </button>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <label className="mb-2 block font-bold">② スタッフQR</label>

          <div className="flex gap-3">
            <input
              value={staffQr}
              onChange={(e) => setStaffQr(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleStaffQr();
              }}
              placeholder="スタッフQRを読み取り"
              className="flex-1 rounded-lg border p-3"
              disabled={!selectedCarrier}
            />

            <button
              onClick={handleStaffQr}
              disabled={!selectedCarrier}
              className="rounded-lg bg-blue-600 px-5 py-2 text-white disabled:bg-gray-400"
            >
              追加
            </button>
          </div>

          <p className="mt-2 text-sm text-gray-500">
            同じスタッフQRを複数回読むと、個数が自動で増えます。
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
              onClick={handleRegister}
              disabled={loading || items.length === 0}
              className="rounded-lg bg-blue-600 px-5 py-3 font-bold text-white disabled:bg-gray-400"
            >
              {loading ? "登録中..." : "作業完了・一括登録"}
            </button>
          </div>

          {items.length === 0 ? (
            <p className="text-gray-500">まだスタッフQRが読み取られていません。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="p-3">宛先スタッフ</th>
                    <th className="p-3">部署</th>
                    <th className="p-3">会社</th>
                    <th className="p-3">本人メール</th>
                    <th className="p-3">共有メール</th>
                    <th className="p-3">個数</th>
                    <th className="p-3">操作</th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((item) => (
                    <tr key={item.staff.id} className="border-b">
                      <td className="p-3 font-bold">{item.staff.staff_name}</td>
                      <td className="p-3">{item.staff.department ?? "-"}</td>
                      <td className="p-3">{item.staff.companies?.name ?? "-"}</td>
                      <td className="p-3">{item.staff.email ?? "-"}</td>
                      <td className="p-3">{item.staff.group_email ?? "-"}</td>
                      <td className="p-3">
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) =>
                            changeQuantity(item.staff.id, Number(e.target.value))
                          }
                          className="w-20 rounded border p-2"
                        />
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => removeItem(item.staff.id)}
                          className="rounded bg-red-600 px-3 py-1 text-white"
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-3 text-lg font-bold">テスト用QR値</h2>
          <p className="text-sm text-gray-600">
            配送会社：CARRIER_YAMATO / CARRIER_SAGAWA / CARRIER_JAPANPOST
          </p>
          <p className="text-sm text-gray-600">
            スタッフQRはスタッフ管理画面で確認できます。
          </p>
        </div>
      </div>
    </main>
  );
}