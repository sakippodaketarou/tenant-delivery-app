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

export default function TenantChatPage() {
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const scrollToBottom = () => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const fetchMessages = async (roomId: string) => {
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
      return;
    }

    setMessages((data ?? []) as unknown as ChatMessage[]);
    scrollToBottom();
  };

  const fetchInitialData = async () => {
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
      .select("id, company_id, name, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profileData) {
      alert("ログイン情報取得エラー：" + (profileError?.message ?? ""));
      setLoading(false);
      return;
    }

    const myProfile = profileData as MyProfile;
    setProfile(myProfile);

    const { data: existingRoom, error: roomFetchError } = await supabase
      .from("chat_rooms")
      .select("id, company_id, title, created_at")
      .eq("company_id", myProfile.company_id)
      .maybeSingle();

    if (roomFetchError) {
      alert("チャットルーム取得エラー：" + roomFetchError.message);
      setLoading(false);
      return;
    }

    let currentRoom = existingRoom as ChatRoom | null;

    if (!currentRoom) {
      const { data: newRoom, error: roomCreateError } = await supabase
        .from("chat_rooms")
        .insert({
          company_id: myProfile.company_id,
          title: "管理者チャット",
        })
        .select("id, company_id, title, created_at")
        .single();

      if (roomCreateError || !newRoom) {
        alert("チャットルーム作成エラー：" + (roomCreateError?.message ?? ""));
        setLoading(false);
        return;
      }

      currentRoom = newRoom as ChatRoom;
    }

    setRoom(currentRoom);
    await fetchMessages(currentRoom.id);
    setLoading(false);
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (!room?.id) return;

    const channel = supabase
      .channel(`tenant-chat-room-${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `room_id=eq.${room.id}`,
        },
        async () => {
          await fetchMessages(room.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null;
    setFile(selectedFile);
  };

  const uploadFile = async () => {
    if (!file || !room || !profile) {
      return {
        attachmentUrl: null,
        attachmentName: null,
      };
    }

    const fileExt = file.name.split(".").pop();
    const fileName = `${profile.company_id}/${room.id}/${Date.now()}-${Math.random()
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
    if (!profile || !room) {
      alert("チャット情報が取得できていません。");
      return;
    }

    if (!message.trim() && !file) {
      return;
    }

    const sendText = message.trim();

    setSending(true);

    try {
      const { attachmentUrl, attachmentName } = await uploadFile();

      const { error } = await supabase.from("chat_messages").insert({
        room_id: room.id,
        company_id: profile.company_id,
        sender_user_id: profile.id,
        sender_role: profile.role ?? "tenant",
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
      await fetchMessages(room.id);
    } catch (error: any) {
      alert(error.message ?? "送信エラー");
    }

    setSending(false);
  };

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between rounded-2xl bg-white p-6 shadow">
          <div>
            <h1 className="text-2xl font-bold">管理者チャット</h1>
            <p className="text-sm text-gray-500">
              管理者へ荷物や受取状況について連絡できます。
            </p>
          </div>

          <button
            onClick={() => router.push("/tenant/home")}
            className="rounded-lg bg-black px-4 py-2 text-white"
          >
            テナント画面へ戻る
          </button>
        </div>

        <div className="rounded-2xl bg-white shadow">
          <div className="border-b p-5">
            <p className="font-bold">
              チャットルーム：{room?.title ?? "管理者チャット"}
            </p>
            <p className="text-sm text-gray-500">
              ログイン中：{profile?.name ?? "-"}
            </p>
          </div>

          <div className="h-[520px] overflow-y-auto bg-gray-50 p-5">
            {loading ? (
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
                            添付：{item.attachment_name ?? "ファイルを開く"}
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
              placeholder="メッセージを入力してください（Ctrl + Enterで送信）"
              className="min-h-24 w-full rounded-xl border p-3"
            />

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <input type="file" onChange={handleFileChange} />
                {file && (
                  <p className="mt-1 text-sm text-gray-500">
                    選択中：{file.name}
                  </p>
                )}
              </div>

              <button
                onClick={sendMessage}
                disabled={sending || (!message.trim() && !file)}
                className="w-full rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:bg-gray-400 md:w-32"
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