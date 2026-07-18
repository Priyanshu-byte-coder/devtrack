import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Community Guidelines | DevTrack",
    description:
        "Guidelines and expectations for participating in the DevTrack community.",
};

export default function GuidelinesPage() {
    return (

        <main className="min-h-screen bg-[var(--background)]">
            <div className="max-w-5xl mx-auto py-8 px-4">
                <h1 className="text-4xl font-bold mb-3 text-[var(--foreground)]">
                    Community Guidelines
                </h1>

                <p className="text-[var(--muted-foreground)] mb-8">
                    DevTrack aims to maintain a welcoming, collaborative, and
                    inclusive environment for all contributors, maintainers,
                    and community members.
                </p>

                <div className="space-y-6">
                    {[
                        {
                            title: "Respect Everyone",
                            content:
                                "Treat all community members with respect regardless of experience level, background, identity, nationality, beliefs, or personal characteristics.",
                        },
                        {
                            title: "Encourage Positive Collaboration",
                            content:
                                "Share knowledge, provide constructive feedback, and support other contributors. Open-source projects grow through teamwork and mutual respect.",
                        },
                        {
                            title: "Acceptable Behaviour",
                            content:
                                "Demonstrate kindness, professionalism, empathy, and willingness to learn. Healthy discussions and differing viewpoints are welcome when expressed respectfully.",
                        },
                        {
                            title: "Unacceptable Behaviour",
                            content:
                                "Harassment, discrimination, personal attacks, abusive language, trolling, intimidation, or sharing private information without consent are not tolerated.",
                        },
                        {
                            title: "Reporting Concerns",
                            content:
                                "Community members who encounter behaviour that violates these guidelines are encouraged to report concerns through the project's official communication and reporting channels.",
                        },
                        {
                            title: "Code of Conduct",
                            content:
                                "These guidelines are inspired by the project's Code of Conduct and Contributor Covenant principles. All participants are expected to follow them while engaging with the DevTrack community.",
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