import { NextRequest, NextResponse } from "next/server";
import { checkContactRateLimit, getContactClientIp } from "@/lib/contact-rate-limit";

export const dynamic = "force-dynamic";

type ContactPayload = {
  name?: unknown;
  email?: unknown;
  message?: unknown;
  website?: unknown; // honeypot
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function POST(request: NextRequest) {
  let payload: ContactPayload;

  try {
    payload = (await request.json()) as ContactPayload;
  } catch (e) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Honeypot check for bots
  if (payload.website) {
    // Silently ignore spam by returning a mock success response
    return NextResponse.json({ success: true });
  }

  // In-route rate limiting check (3 requests per IP per hour)
  const ip = getContactClientIp(request);
  const rateLimitResult = checkContactRateLimit(ip);

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Too many contact submissions. Please try again in an hour." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(rateLimitResult.reset - Math.ceil(Date.now() / 1000), 1)),
        },
      }
    );
  }

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const message = typeof payload.message === "string" ? payload.message.trim() : "";

  if (!name || !email || !message) {
    return NextResponse.json({ error: "Name, email, and message are required." }, { status: 400 });
  }

  // Bound length before regex to prevent ReDoS on pathological inputs
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (email.length > 254 || !emailPattern.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const toEmail = process.env.CONTACT_TO_EMAIL;

  if (!apiKey || !fromEmail || !toEmail) {
    return NextResponse.json(
      {
        error:
          "Contact delivery is not configured. Set RESEND_API_KEY, RESEND_FROM_EMAIL, and CONTACT_TO_EMAIL.",
      },
      { status: 503 }
    );
  }

  const subject = `DevTrack contact message from ${name}`;
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeMessage = escapeHtml(message).replaceAll("\n", "<br />");

  const html = `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #0f172a; line-height: 1.6;">
      <h2 style="margin: 0 0 12px; font-size: 20px;">New DevTrack contact message</h2>
      <p style="margin: 0 0 8px;"><strong>Name:</strong> ${safeName}</p>
      <p style="margin: 0 0 8px;"><strong>Email:</strong> ${safeEmail}</p>
      <p style="margin: 0 0 12px;"><strong>Message:</strong></p>
      <div style="white-space: normal; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;">
        ${safeMessage}
      </div>
    </div>
  `;

  const text = `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: toEmail,
      subject,
      html,
      text,
      reply_to: email,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Contact email send failed:", response.status, errorText);

    return NextResponse.json(
      { error: "Failed to send your message. Please try again later." },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true });
}
