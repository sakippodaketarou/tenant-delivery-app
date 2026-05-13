"use client";

import { useEffect, useRef, useState } from "react";
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
  shipperName: string;
};

export default function RegisterPackagePage() {
  const router = useRouter();

  const carrierInputRef = useRef<HTMLInputElement | null>(null);
  const shipperInputRef = useRef<HTMLInputElement | null>(null);
  const staffInputRef = useRef<HTMLInputElement | null>(null);

  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [selectedCarrier, setSelectedCarrier] = useState<Carrier | null>(null);

  const [carrierQr, setCarrierQr] = useState("");
  const [staffQr, setStaffQr] = useState("");
  const [shipperName, setShipperName] = useState("");

  const [items, setItems] = useState<ScannedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanMessage, setScanMessage] = useState("配送会社QRを読み取ってください。");

  const playSuccessSound = () => {
    try {
      const audioContext = new window.AudioContext();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.frequency.value = 880;
      oscillator.type = "sine";

      gain.gain.setValueAtTime(0.08, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + 0.12
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.12);
    } catch {
      // 音が鳴らない環境でも処理は継続
    }
  };

  const playErrorSound = () => {
    try {
      const audioContext = new window.AudioContext();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.frequency.value = 220;
      oscillator.type = "square";

      gain.gain.setValueAtTime(0.06, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + 0.18
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.18);
    } catch {
      // 音が鳴らない環境でも処理は継続
    }
  };

  const focusCarrierInput = () => {
    setTimeout(() => {
      carrierInputRef.current?.focus();
    }, 80);
  };

  const focusShipperInput = () => {
    setTimeout(() => {
      shipperInputRef.current?.focus();
    }, 80);
  };

  const focusStaffInput = () => {
    setTimeout(() => {
      staffInputRef.current?.focus();
    }, 80);
  };

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
    focusCarrierInput();
  }, []);

  useEffect(() => {
    if (selectedCarrier) {
      if (shipperName.trim()) {
        focusStaffInput();
      } else {
        focusShipperInput();
      }
    }
  }, [selectedCarrier]);

  const handleCarrierQr = () => {
    const value = carrierQr.trim();

    if (!value) {
      playErrorSound();
      alert("配送会社QRを入力してください。");
      focusCarrierInput();
      return;
    }

    const carrier = carriers.find((item) => item.barcode_value === value);

    if (!carrier) {
      playErrorSound();
      setCarrierQr("");
      setScanMessage("配送会社が見つかりません。もう一度読み取ってください。");
      focusCarrierInput();
      return;
    }

    setSelectedCarrier(carrier);
    setCarrierQr("");
    setScanMessage(`${carrier.name} を選択しました。荷主名を入力してください。`);
    playSuccessSound();
    focusShipperInput();
  };

  const handleStaffQr = async () => {
    if (!selectedCarrier) {
      playErrorSound();
      alert("先に配送会社QRを読み取ってください。");
      focusCarrierInput();
      return;
    }

    if (!shipperName.trim()) {
      playErrorSound();
      alert("荷主名を入力してください。");
      focusShipperInput();
      return;
    }

    const value = staffQr.trim();

    if (!value) {
      playErrorSound();
      setScanMessage("スタッフQRを読み取ってください。");
      focusStaffInput();
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
      playErrorSound();
      setStaffQr("");
      setScanMessage("スタッフが見つかりません。もう一度読み取ってください。");
      focusStaffInput();
      return;
    }

    const staff = data as unknown as Staff;
    const currentShipperName = shipperName.trim();

    setItems((prev) => {
      const existing = prev.find(
        (item) =>
          item.staff.id === staff.id && item.shipperName === currentShipperName
      );

      if (existing) {
        return prev.map((item) =>
          item.staff.id === staff.id && item.shipperName === currentShipperName
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [
        ...prev,
        {
          staff,
          quantity: 1,
          shipperName: currentShipperName,
        },
      ];
    });

    setStaffQr("");
    setScanMessage(
      `${staff.staff_name} さんを追加しました。続けてスタッフQRを読み取れます。`
    );
    playSuccessSound();
    focusStaffInput();
  };

  const changeQuantity = (
    staffId: string,
    currentShipperName: string,
    quantity: number
  ) => {
    setItems((prev) =>
      prev.map((item) =>
        item.staff.id === staffId && item.shipperName === currentShipperName
          ? { ...item, quantity: Math.max(1, quantity) }
          : item
      )
    );
  };

  const changeShipperName = (
    staffId: string,
    oldShipperName: string,
    newShipperName: string
  ) => {
    setItems((prev) =>
      prev.map((item) =>
        item.staff.id === staffId && item.shipperName === oldShipperName
          ? { ...item, shipperName: newShipperName }
          : item
      )
    );
  };

  const removeItem = (staffId: string, currentShipperName: string) => {
    setItems((prev) =>
      prev.filter(
        (item) =>
          !(item.staff.id === staffId && item.shipperName === currentShipperName)
      )
    );
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
        shipperName: item.shipperName,
        location: "部署ごとの保管ロケーション",
      }),
    });
  };

  const handleRegister = async () => {
    if (!selectedCarrier) {
      alert("配送会社が未選択です。");
      focusCarrierInput();
      return;
    }

    if (items.length === 0) {
      alert("登録する荷物がありません。");
      focusStaffInput();
      return;
    }

    const hasEmptyShipper = items.some((item) => !item.shipperName.trim());

    if (hasEmptyShipper) {
      alert("荷主名が空の荷物があります。");
      return;
    }

    const ok = confirm(`${items.length}件の荷物を登録しますか？`);

    if (!ok) {
      focusStaffInput();
      return;
    }

    setLoading(true);

    const insertRows = items.map((item) => ({
      company_id: item.staff.company_id,
      carrier_id: selectedCarrier.id,
      recipient_staff_id: item.staff.id,
      quantity: item.quantity,
      shipper_name: item.shipperName.trim(),
      status: "unreceived",
      arrived_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from("packages").insert(insertRows);

    if (error) {
      setLoading(false);
      alert("荷物登録エラー：" + error.message);
      focusStaffInput();
      return;
    }

    for (const item of items) {
      await sendArrivalMail(item);
    }

    setLoading(false);
    playSuccessSound();

    alert("荷物登録とメール通知が完了しました。");

    setSelectedCarrier(null);
    setItems([]);
    setCarrierQr("");
    setStaffQr("");
    setShipperName("");
    setScanMessage("配送会社QRを読み取ってください。");

    focusCarrierInput();
  };

  const resetWork = () => {
    const ok = confirm("現在の作業内容をリセットしますか？");

    if (!ok) return;

    setSelectedCarrier(null);
    setItems([]);
    setCarrierQr("");
    setStaffQr("");
    setShipperName("");
    setScanMessage("配送会社QRを読み取ってください。");
    focusCarrierInput();
  };

  const changeCarrier = () => {
    const ok = confirm("配送会社を変更しますか？現在読み取った荷物一覧は残ります。");

    if (!ok) {
      focusStaffInput();
      return;
    }

    setSelectedCarrier(null);
    setCarrierQr("");
    setScanMessage("配送会社QRを読み取ってください。");
    focusCarrierInput();
  };

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-bold text-blue-600">
              Barcode Operation
            </p>
            <h1 className="text-2xl font-bold text-slate-900">
              荷捌き場 荷物登録
            </h1>
            <p className="text-sm text-slate-500">
              配送会社QR → 荷主名 → スタッフQRの順に登録します。
              バーコードリーダーはCR/Enter送信設定で運用してください。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={resetWork}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-bold text-slate-700 hover:bg-slate-100"
            >
              作業リセット
            </button>

            <button
              onClick={() => router.push("/home")}
              className="rounded-xl bg-slate-900 px-4 py-2 font-bold text-white"
            >
              ホームへ戻る
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <p className="text-sm font-bold text-blue-700">読取ステータス</p>
          <p className="mt-1 text-lg font-bold text-blue-900">
            {scanMessage}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <label className="mb-2 block font-bold text-slate-900">
              ① 配送会社QR
            </label>

            {selectedCarrier ? (
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm text-slate-500">現在の配送会社</p>
                <p className="text-xl font-bold text-slate-900">
                  {selectedCarrier.name}
                </p>

                <button
                  onClick={changeCarrier}
                  className="mt-4 rounded-lg bg-red-600 px-4 py-2 font-bold text-white"
                >
                  配送会社を変更
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  ref={carrierInputRef}
                  value={carrierQr}
                  onChange={(e) => setCarrierQr(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCarrierQr();
                  }}
                  placeholder="配送会社QRを読み取り"
                  className="w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  autoFocus
                />

                <button
                  onClick={handleCarrierQr}
                  className="w-full rounded-xl bg-blue-600 px-5 py-3 font-bold text-white"
                >
                  読取
                </button>
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <label className="mb-2 block font-bold text-slate-900">
              ② 荷主名
            </label>

            <input
              ref={shipperInputRef}
              value={shipperName}
              onChange={(e) => setShipperName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  focusStaffInput();
                }
              }}
              placeholder="例：株式会社〇〇 / 〇〇商店"
              className="w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
              disabled={!selectedCarrier}
            />

            <p className="mt-2 text-sm text-slate-500">
              荷主名入力後はスタッフQR欄へ自動移動できます。
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <label className="mb-2 block font-bold text-slate-900">
              ③ スタッフQR
            </label>

            <div className="space-y-3">
              <input
                ref={staffInputRef}
                value={staffQr}
                onChange={(e) => setStaffQr(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleStaffQr();
                }}
                placeholder="スタッフQRを読み取り"
                className="w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                disabled={!selectedCarrier}
              />

              <button
                onClick={handleStaffQr}
                disabled={!selectedCarrier}
                className="w-full rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:bg-slate-400"
              >
                追加
              </button>
            </div>

            <p className="mt-2 text-sm text-slate-500">
              読取後、自動でクリアして再フォーカスします。
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                今回登録する荷物
              </h2>
              <p className="text-sm text-slate-500">
                配送会社：{selectedCarrier?.name ?? "未選択"} / 登録件数：
                {items.length}件 / 合計個数：{totalQuantity}個
              </p>
            </div>

            <button
              onClick={handleRegister}
              disabled={loading || items.length === 0}
              className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:bg-slate-400"
            >
              {loading ? "登録中..." : "作業完了・一括登録"}
            </button>
          </div>

          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
              まだスタッフQRが読み取られていません。
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left">
                    <th className="p-3">宛先スタッフ</th>
                    <th className="p-3">部署</th>
                    <th className="p-3">会社</th>
                    <th className="p-3">荷主</th>
                    <th className="p-3">本人メール</th>
                    <th className="p-3">共有メール</th>
                    <th className="p-3">個数</th>
                    <th className="p-3">操作</th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((item) => (
                    <tr
                      key={`${item.staff.id}-${item.shipperName}`}
                      className="border-b"
                    >
                      <td className="p-3 font-bold text-slate-900">
                        {item.staff.staff_name}
                      </td>

                      <td className="p-3">{item.staff.department ?? "-"}</td>

                      <td className="p-3">
                        {item.staff.companies?.name ?? "-"}
                      </td>

                      <td className="p-3">
                        <input
                          value={item.shipperName}
                          onChange={(e) =>
                            changeShipperName(
                              item.staff.id,
                              item.shipperName,
                              e.target.value
                            )
                          }
                          className="w-40 rounded border border-slate-200 p-2"
                        />
                      </td>

                      <td className="p-3">{item.staff.email ?? "-"}</td>
                      <td className="p-3">{item.staff.group_email ?? "-"}</td>

                      <td className="p-3">
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) =>
                            changeQuantity(
                              item.staff.id,
                              item.shipperName,
                              Number(e.target.value)
                            )
                          }
                          className="w-20 rounded border border-slate-200 p-2"
                        />
                      </td>

                      <td className="p-3">
                        <button
                          onClick={() =>
                            removeItem(item.staff.id, item.shipperName)
                          }
                          className="rounded bg-red-600 px-3 py-1 font-bold text-white"
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

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-bold text-slate-900">
            運用メモ
          </h2>
          <div className="space-y-1 text-sm text-slate-600">
            <p>配送会社：CARRIER_YAMATO / CARRIER_SAGAWA / CARRIER_JAPANPOST</p>
            <p>バーコードリーダーは「読取後 Enter / CR 送信」に設定してください。</p>
            <p>
              同じ荷主・同じ宛先スタッフを複数回読み取ると個数が自動で増えます。
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}