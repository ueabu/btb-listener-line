import type { Metadata } from "next";
import HostPage from "@/components/host/HostPage";

export const metadata: Metadata = {
  title: "Host board · Listener Line",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <HostPage />;
}
