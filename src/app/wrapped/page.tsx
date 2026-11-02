import WrappedExperience from "@/components/WrappedExperience";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "@/lib/server-session";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Year in Code | DevTrack",
  description: "A shareable annual recap of your coding activity.",
};

export default async function WrappedPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.error === "TokenRevoked") {
    redirect("/");
  }

  return <WrappedExperience />;
}
