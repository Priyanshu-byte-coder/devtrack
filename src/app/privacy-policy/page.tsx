import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Privacy Policy | DevTrack",
    description:
        "Learn how DevTrack collects, uses, and protects user information.",
};

export default function PrivacyPolicyPage() {
    return (

        <main className="min-h-screen bg-[var(--background)]">
            <div className="max-w-5xl mx-auto py-8 px-4">
                <h1 className="text-4xl font-bold mb-3 text-[var(--foreground)]">
                    Privacy Policy
                </h1>
                <p className="text-[var(--muted-foreground)] mb-8">
                    DevTrack respects your privacy and is committed to protecting
                    information shared through the platform. This policy outlines
                    what information may be collected and how it may be used.
                </p>

                <div className="space-y-6">
                    {[
                        {
                            title: "Information We Collect",
                            content:
                                "DevTrack may collect information required for authentication, account management, and platform functionality. This can include GitHub profile information, contribution statistics, repository activity, and user preferences.",
                        },
                        {
                            title: "How Information Is Used",
                            content:
                                "Information is used to provide dashboard features, generate analytics, improve user experience, and maintain platform reliability and security.",
                        },
                        {
                            title: "Third-Party Services",
                            content:
                                "DevTrack integrates with services such as GitHub, Supabase, and other tools required for authentication, data storage, and analytics. These services operate under their own privacy policies.",
                        },
                        {
                            title: "Data Protection",
                            content:
                                "Reasonable technical and organizational measures are implemented to protect user information from unauthorized access, disclosure, or misuse.",
                        },
                        {
                            title: "Open Source Transparency",
                            content:
                                "DevTrack is an open-source project. While source code is publicly available, personal information is handled separately and is not intentionally exposed through public repositories.",
                        },
                        {
                            title: "Contact",
                            content:
                                "Questions regarding privacy or data handling may be directed to the project maintainers through the official GitHub repository.",
                        },
                    ].map((section) => (
                        <div
                            key={section.title}
                            className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6"
                        >
                            <h2 className="text-xl font-semibold text-[var(--foreground)]">
                                {section.title}
                            </h2>

                            <p className="mt-3 text-[var(--muted-foreground)] leading-7">
                                {section.content}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

        </main>
    );

}