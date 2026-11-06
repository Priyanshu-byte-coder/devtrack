import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import PersonalityReport from "@/components/personality/PersonalityReport";

export default async function PersonalityPage() {
    const session = await getServerSession(authOptions);
    if (!session) redirect("/");
    return <PersonalityReport />;
}