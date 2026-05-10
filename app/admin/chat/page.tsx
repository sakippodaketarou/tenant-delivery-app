"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
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
  unread_count?: number;
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
  attachment_url: string | null;
  attachment_name: string | null;
  is_read: boolean;
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
  const [file, setFile] = useState<File | null>(null);

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

    const { data: roomData, error: roomError } = await supabase
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

    if (roomError) {
      alert("チャットルーム取得エラー：" + roomError.message);
      setLoadingRooms(false);
      return;
    }

    const roomList = (roomData ?? []) as unknown as ChatRoom[];

    const roomIds = roomList.map((room) => room.id);

    let unreadMap = new Map<string, number>();

    if (roomIds.length > 0) {
      const { data: unreadData } = await supabase
        .from("chat_messages")
        .select("id, room_id")
        .in("room_id", roomIds)
        .eq("is_read", false)
        .neq("sender_role", "admin");

      unreadMap = (unreadData ?? []).reduce((map, item: any) => {
        const current = map.get(item.room_id) ?? 0;
        map.set(item.room_id, current + 1);
        return map;
      }, new Map<string, number>());
    }

    const roomsWithUnread = roomList.map((room) => ({
      ...room,
      unread_count: unreadMap.get(room.id) ?? 0,
    }));

    setRooms(roomsWithUnread);

    if (!selectedRoom && roomsWithUnread.length > 0) {
      setSelectedRoom(roomsWithUnread[0]);
      await fetchMessages(roomsWithUnread[0].id);
    }

    setLoadingRooms(false);
  };

  const markRoomAsRead = async (roomId: string) => {
    await supabase
      .from("chat_messages")
      .update({
        is_read: true,
      })
      .eq("room_id", roomId)
      .neq("sender_role", "admin");
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
        attachment_url,
        attachment_name,
        is_read,
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

    await markRoomAsRead(roomId);
    await fetchRoomsWithoutAutoSelect();

    setLoadingMessages(false);
    scrollToBottom();
  };

  const fetchRoomsWithoutAutoSelect = async () => {
    const { data: roomData } = await supabase
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

    const roomList = (roomData ?? []) as unknown as ChatRoom[];
    const roomIds = roomList.map((room) => room.id);

    let unreadMap = new Map<string, number>();

    if (roomIds.length > 0) {
      const { data: unreadData } = await supabase
        .from("chat_messages")
        .select("id, room_id")
        .in("room_id", roomIds)
        .eq("is_read", false)
        .neq("sender_role", "admin");

      unreadMap = (unreadData ?? []).reduce((map, item: any) => {
        const current = map.get(item.room_id) ?? 0;
        map.set(item.room_id, current + 1);
        return map;
      }, new Map<string, number>());
    }

    setRooms(
      roomList.map((room) => ({
        ...room,
        unread_count: unreadMap.get(room.id) ?? 0,
      }))
    );
  };

  const selectRoom = async (room: ChatRoom) => {
    setSelectedRoom(room);
    await fetchMessages(room.id);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null;
    setFile(selectedFile);
  };

  const uploadFile = async () => {
    if (!file || !selectedRoom || !profile) {
      return {
        attachmentUrl: null,
        attachmentName: null,
      };
    }

    const fileExt = file.name.split(".").pop();
    const fileName = `${selectedRoom.company_id}/${selectedRoom.id}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${fileExt}`;

    const { error } = await supabase.storage
      .from("chat-files")
      .upload(fileName, file);

    if (error) {
      throw new Error("ファイルアップロードエラー：" + error.message);
    }

    const { data } = supabase.storage.from("chat-files").getPublicUrl(fileName);

    return {
      attachmentUrl: data.publicUrl,
      attachmentName: file.name,
    };
  };

  const sendMessage = async () => {
    if (!profile || !selectedRoom) {
      alert("チャットルームを選択してください。");
      return;
    }

    if (!message.trim() && !file) return;

    const sendText = message.trim();

    setSending(true);

    try {
      const { attachmentUrl, attachmentName } = await uploadFile();

      const { error } = await supabase.from("chat_messages").insert({
        room_id: selectedRoom.id,
        company_id: selectedRoom.company_id,
        sender_user_id: profile.id,
        sender_role: profile.role ?? "admin",
        message: sendText || "添付ファイルを送信しました。",
        attachment_url: attachmentUrl,
        attachment_name: attachmentName,
        is_read: false,
      });

      if (error) {
        throw new Error("メッセージ送信エラー：" + error.message);
      }

      setMessage("");
      setFile(null);
      await fetchMessages(selectedRoom.id);
    } catch (error: any) {
      alert(error.message ?? "送信エラー");
    }

    setSending(false);
  };

  useEffect(() => {
    const init = async () => {
      await fetchMyProfile();
      await fetchRooms();
    };

    init();
  }, []);

  useEffect(() => {
    if (!selectedRoom?.id) return;

    const channel = supabase
      .channel(`admin-chat-room-${selectedRoom.id}`)
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

  useEffect(() => {
    const channel = supabase
      .channel("admin-chat-rooms-list")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_rooms",
        },
        async () => {
          await fetchRooms();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        async () => {
          await fetchRoomsWithoutAutoSelect();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

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

        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <div className="rounded-2xl bg-white p-5 shadow">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">チャット一覧</h2>

              <button
                onClick={fetchRooms}
                className="rounded-lg border px-3 py-1 text-sm"
              >
                更新
              </button>
            </div>

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
                    className={`relative w-full rounded-xl border p-4 text-left transition hover:bg-gray-50 ${
                      selectedRoom?.id === room.id
                        ? "border-blue-600 bg-blue-50"
                        : "bg-white"
                    }`}
                  >
                    {room.unread_count && room.unread_count > 0 ? (
                      <span className="absolute right-3 top-3 rounded-full bg-red-600 px-2 py-1 text-xs font-bold text-white">
                        {room.unread_count}
                      </span>
                    ) : null}

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

                          {item.attachment_url && (
                            <a
                              href={item.attachment_url}
                              target="_blank"
                              rel="noreferrer"
                              className={`mt-3 block rounded-lg px-3 py-2 text-sm font-bold ${
                                isMine
                                  ? "bg-white text-blue-600"
                                  : "bg-blue-50 text-blue-600"
                              }`}
                            >
                              添付：
                              {item.attachment_name ?? "ファイルを開く"}
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            <div className="space-y-3 border-t p-5">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    sendMessage();
                  }
                }}
                placeholder={
                  selectedRoom
                    ? "返信メッセージを入力してください（Ctrl + Enterで送信）"
                    : "左の一覧からチャットを選択してください"
                }
                disabled={!selectedRoom}
                className="min-h-24 w-full rounded-xl border p-3 disabled:bg-gray-100"
              />

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <input
                    type="file"
                    onChange={handleFileChange}
                    disabled={!selectedRoom}
                  />
                  {file && (
                    <p className="mt-1 text-sm text-gray-500">
                      選択中：{file.name}
                    </p>
                  )}
                </div>

                <button
                  onClick={sendMessage}
                  disabled={sending || !selectedRoom || (!message.trim() && !file)}
                  className="w-full rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:bg-gray-400 md:w-32"
                >
                  {sending ? "送信中" : "送信"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}