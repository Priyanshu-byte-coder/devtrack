import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

async function callGroq(prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return "AI insights unavailable — GROQ_API_KEY not configured.";

  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama3-8b-8192",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1024,
      temperature: 0.7,
    }),
  });

  if (!res.ok) throw new Error("Groq API error");
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "No response generated.";
}

async function fetchRepoData(owner: string, repo: string) {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const safeOwner = encodeURIComponent(owner);
  const safeRepo = encodeURIComponent(repo);
  const [repoRes, readmeRes, languagesRes] = await Promise.all([
    fetch(`https://api.github.com/repos/${safeOwner}/${safeRepo}`, { headers }),
    fetch(`https://api.github.com/repos/${safeOwner}/${safeRepo}/readme`, { headers }),
    fetch(`https://api.github.com/repos/${safeOwner}/${safeRepo}/languages`, { headers }),
  ]);

  const repoData = repoRes.ok ? await repoRes.json() : {};
  const readmeData = readmeRes.ok ? await readmeRes.json() : {};
  const languages = languagesRes.ok ? await languagesRes.json() : {};

  let readmeContent = "";
  if (readmeData.content) {
    readmeContent = Buffer.from(readmeData.content, "base64").toString("utf-8").slice(0, 2000);
  }

  return { repoData, readmeContent, languages };
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { repoUrl, action, question } = await req.json();

    if (!repoUrl) return NextResponse.json({ error: "repo URL required" }, { status: 400 });

    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) return NextResponse.json({ error: "Invalid GitHub URL" }, { status: 400 });

    const [, owner, repo] = match;
    // Validate owner and repo are valid GitHub identifiers to prevent path traversal
    const githubIdentifier = /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]{0,97}[a-zA-Z0-9])?$/;
    if (!githubIdentifier.test(owner) || !githubIdentifier.test(repo.replace(/\.git$/, "")))
      return NextResponse.json({ error: "Invalid GitHub URL" }, { status: 400 });
    const { repoData, readmeContent, languages } = await fetchRepoData(owner, repo);

    const techStack = Object.keys(languages).join(", ") || "Unknown";
    const description = repoData.description || "No description";
    const repoName = repoData.name || repo;
    const topics = (repoData.topics || []).join(", ");

    const context = `
Project: ${repoName}
Description: ${description}
Tech Stack: ${techStack}
Topics: ${topics}
Stars: ${repoData.stargazers_count ?? 0}
README (excerpt): ${readmeContent}
    `.trim();

    if (action === "analyze") {
      const prompt = `You are an expert software engineer helping a student prepare for technical interviews.

Analyze this GitHub project and provide:
1. A brief project summary (2-3 sentences)
2. Key features (3-5 bullet points)
3. Tech stack breakdown and why each technology was likely chosen
4. Potential architectural decisions and tradeoffs
5. Common challenges in this type of project

Project context:
${context}

Format your response with clear headings using markdown.`;

      const analysis = await callGroq(prompt);
      return NextResponse.json({ analysis, techStack, description: repoData.description });
    }

    if (action === "questions") {
      const prompt = `You are a senior software engineer conducting technical interviews.

Generate interview questions for this project at three difficulty levels:

Project context:
${context}

Generate exactly:
- 3 Easy questions (basic understanding, what/why questions)
- 3 Medium questions (implementation details, design decisions)
- 3 Advanced questions (scalability, edge cases, improvements)

Format as JSON:
{
  "easy": ["question1", "question2", "question3"],
  "medium": ["question1", "question2", "question3"],
  "advanced": ["question1", "question2", "question3"]
}

Return ONLY the JSON, no other text.`;

      const raw = await callGroq(prompt);
      try {
        const clean = raw.replace(/```json|```/g, "").trim();
        const questions = JSON.parse(clean);
        return NextResponse.json({ questions });
      } catch {
        return NextResponse.json({
          questions: {
            easy: ["What is the main purpose of this project?", "What technologies did you use?", "How do you run this project locally?"],
            medium: ["How did you structure your codebase?", "What was the most challenging part?", "How did you handle errors?"],
            advanced: ["How would you scale this?", "What would you do differently?", "How would you add authentication?"],
          }
        });
      }
    }

    if (action === "chat") {
      const prompt = `You are an AI tutor helping a student prepare for technical interviews about their project.

Project context:
${context}

Student question: ${question}

Give a clear, concise answer focused on interview preparation. Keep it under 200 words.`;

      const answer = await callGroq(prompt);
      return NextResponse.json({ answer });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Project tutor error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}