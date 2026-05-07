"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type MyProfile = {
  id: string;
  company_id: string;
  name: string;
  role: string | null;
};

type ChatRoom = {
  id: string;
  company_id: string;
  title: string | null;
  created_at: string;
  companies: {
    name: string;
  } | null;
};

type ChatMessage = {
  id: string;
  room_id: string;
  company_id: string;
  sender_user_id: string;
  sender_role: string | null;
  message: string;
  created_at: string;
  profiles?: {
    name: string;
  } | null;
};

export default function AdminChatPage() {
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const scrollToBottom = () => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const fetchMyProfile = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return null;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, company_id, name, role")
      .eq("id", user.id)
      .single();

    if (error || !data) {
      alert("ログイン情報取得エラー：" + (error?.message ?? ""));
      return null;
    }

    const myProfile = data as MyProfile;
    setProfile(myProfile);
    return myProfile;
  };

  const fetchRooms = async () => {
    setLoadingRooms(true);

    const { data, error } = await supabase
      .from("chat_rooms")
      .select(`
        id,
        company_id,
        title,
        created_at,
        companies (
          name
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      alert("チャットルーム取得エラー：" + error.message);
      setLoadingRooms(false);
      return;
    }

    setRooms((data ?? []) as unknown as ChatRoom[]);
    setLoadingRooms(false);
  };

  const fetchMessages = async (roomId: string) => {
    setLoadingMessages(true);

    const { data, error } = await supabase
      .from("chat_messages")
      .select(`
        id,
        room_id,
        company_id,
        sender_user_id,
        sender_role,
        message,
        created_at,
        profiles:sender_user_id (
          name
        )
      `)
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });

    if (error) {
      alert("メッセージ取得エラー：" + error.message);
      setLoadingMessages(false);
      return;
    }

    setMessages((data ?? []) as unknown as ChatMessage[]);
    setLoadingMessages(false);
    scrollToBottom();
  };

  const selectRoom = async (room: ChatRoom) => {
    setSelectedRoom(room);
    await fetchMessages(room.id);
  };

  const sendMessage = async () => {
    if (!profile || !selectedRoom) {
      alert("チャットルームを選択してください。");
      return;
    }

    if (!message.trim()) {
      return;
    }

    setSending(true);

    const { error } = await supabase.from("chat_messages").insert({
      room_id: selectedRoom.id,
      company_id: selectedRoom.company_id,
      sender_user_id: profile.id,
      sender_role: profile.role ?? "admin",
      message: message.trim(),
    });

    setSending(false);

    if (error) {
      alert("メッセージ送信エラー：" + error.message);
      return;
    }

    setMessage("");
    await fetchMessages(selectedRoom.id);
  };

  useEffect(() => {
    const init = async () => {
      await fetchMyProfile();
      await fetchRooms();
    };

    init();
  }, []);

  useEffect(() => {
    if (!selectedRoom) return;

    const channel = supabase
      .channel(`admin-chat-${selectedRoom.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `room_id=eq.${selectedRoom.id}`,
        },
        async () => {
          await fetchMessages(selectedRoom.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedRoom?.id]);

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between rounded-2xl bg-white p-6 shadow">
          <div>
            <h1 className="text-2xl font-bold">管理者チャット</h1>
            <p className="text-sm text-gray-500">
              テナントごとの問い合わせを確認・返信できます。
            </p>
          </div>

          <button
            onClick={() => router.push("/home")}
            className="rounded-lg bg-black px-4 py-2 text-white"
          >
            管理画面へ戻る
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="rounded-2xl bg-white p-5 shadow">
            <h2 className="mb-4 text-xl font-bold">チャット一覧</h2>

            {loadingRooms ? (
              <p className="text-gray-500">読み込み中...</p>
            ) : rooms.length === 0 ? (
              <p className="text-gray-500">
                まだチャットルームがありません。
              </p>
            ) : (
              <div className="space-y-3">
                {rooms.map((room) => (
                  <button
                    key={room.id}
                    onClick={() => selectRoom(room)}
                    className={`w-full rounded-xl border p-4 text-left transition hover:bg-gray-50 ${
                      selectedRoom?.id === room.id
                        ? "border-blue-600 bg-blue-50"
                        : "bg-white"
                    }`}
                  >
                    <p className="font-bold">
                      {room.companies?.name ?? "会社名未設定"}
                    </p>

                    <p className="text-sm text-gray-500">
                      {room.title ?? "管理者チャット"}
                    </p>

                    <p className="mt-1 text-xs text-gray-400">
                      作成：
                      {new Date(room.created_at).toLocaleString("ja-JP")}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white shadow">
            <div className="border-b p-5">
              <p className="font-bold">
                {selectedRoom
                  ? selectedRoom.companies?.name ?? "会社名未設定"
                  : "チャット未選択"}
              </p>

              <p className="text-sm text-gray-500">
                {selectedRoom
                  ? selectedRoom.title ?? "管理者チャット"
                  : "左の一覧からチャットを選択してください。"}
              </p>
            </div>

            <div className="h-[520px] overflow-y-auto bg-gray-50 p-5">
              {!selectedRoom ? (
                <p className="text-gray-500">
                  チャットルームを選択してください。
                </p>
              ) : loadingMessages ? (
                <p className="text-gray-500">読み込み中...</p>
              ) : messages.length === 0 ? (
                <p className="text-gray-500">
                  まだメッセージはありません。
                </p>
              ) : (
                <div className="space-y-4">
                  {messages.map((item) => {
                    const isMine = item.sender_user_id === profile?.id;

                    return (
                      <div
                        key={item.id}
                        className={`flex ${
                          isMine ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-3 shadow-sm ${
                            isMine
                              ? "bg-blue-600 text-white"
                              : "bg-white text-black"
                          }`}
                        >
                          <div className="mb-1 text-xs opacity-75">
                            {item.profiles?.name ?? "送信者"} /{" "}
                            {item.sender_role ?? "-"} /{" "}
                            {new Date(item.created_at).toLocaleString("ja-JP")}
                          </div>

                          <p className="whitespace-pre-wrap text-sm">
                            {item.message}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            <div className="flex gap-3 border-t p-5">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  selectedRoom
                    ? "返信メッセージを入力してください"
                    : "左の一覧からチャットを選択してください"
                }
                disabled={!selectedRoom}
                className="min-h-24 flex-1 rounded-xl border p-3 disabled:bg-gray-100"
              />

              <button
                onClick={sendMessage}
                disabled={sending || !selectedRoom}
                className="w-32 rounded-xl bg-blue-600 font-bold text-white disabled:bg-gray-400"
              >
                {sending ? "送信中" : "送信"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}