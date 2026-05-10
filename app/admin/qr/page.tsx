import { redirect } from "next/navigation";

export default function AdminQrRedirectPage() {
  redirect("/admin/qr-list");
}
