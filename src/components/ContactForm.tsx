"use client";

import { useId, useState } from "react";

type FormValues = {
  name: string;
  email: string;
  message: string;
  website?: string; // honeypot
};

type FieldErrors = Partial<Record<keyof FormValues, string>>;

type SubmissionState = "idle" | "submitting" | "success" | "error";

const initialValues: FormValues = {
  name: "",
  email: "",
  message: "",
  website: "",
};

function validate(values: FormValues): FieldErrors {
  const nextErrors: FieldErrors = {};
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!values.name.trim()) {
    nextErrors.name = "Name is required.";
  }

  if (!values.email.trim()) {
    nextErrors.email = "Email is required.";
  } else if (!emailPattern.test(values.email.trim())) {
    nextErrors.email = "Enter a valid email address.";
  }

  if (!values.message.trim()) {
    nextErrors.message = "Message is required.";
  }

  return nextErrors;
}

export default function ContactForm() {
  const nameId = useId();
  const emailId = useId();
  const messageId = useId();
  const statusId = useId();

  const [values, setValues] = useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<SubmissionState>("idle");
  const [feedback, setFeedback] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validate(values);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setStatus("error");
      setFeedback("Please fix the highlighted fields and try again.");
      return;
    }

    setErrors({});
    setStatus("submitting");
    setFeedback("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "We could not submit your message right now.");
      }

      setStatus("success");
      setFeedback("Thanks. Your message has been received.");
      setValues(initialValues);
    } catch (error) {
      setStatus("error");
      setFeedback(
        error instanceof Error ? error.message : "We could not submit your message right now. Please try again."
      );
    }
  }

  function handleChange(field: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));

    if (errors[field]) {
      setErrors((current) => {
        const nextErrors = { ...current };
        delete nextErrors[field];
        return nextErrors;
      });
    }

    if (status !== "idle") {
      setStatus("idle");
      setFeedback("");
    }
  }

  const isSubmitting = status === "submitting";
  const statusTone = status === "error" ? "destructive" : status === "success" ? "success" : "";

  return (
    <form className="rounded-3xl border border-white/10 bg-[#111b2f]/95 p-6 shadow-[0_18px_35px_-24px_rgba(2,6,23,0.85)] sm:p-8" onSubmit={handleSubmit} noValidate>
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#60a5fa]">
          Contact form
        </p>
        <h2 className="text-2xl font-semibold text-[#f8fafc] sm:text-3xl">
          Send a message
        </h2>
        <p className="max-w-xl text-sm leading-6 text-[#94a3b8]">
          Share feedback, ask a question, or report something that needs attention.
        </p>
      </div>

      <div
        aria-live="polite"
        id={statusId}
        className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${
          statusTone === "destructive"
            ? "border-[#7f1d1d] bg-[#2a1216] text-[#fecaca]"
            : statusTone === "success"
              ? "border-[#14532d] bg-[#0f241a] text-[#bbf7d0]"
              : "border-white/10 bg-[#0f172a] text-[#94a3b8]"
        }`}
      >
        {feedback || "All fields are required before sending."}
      </div>

      <div className="mt-6 grid gap-5">
        {/* Honeypot field - completely hidden from human users */}
        <div style={{ display: "none" }} aria-hidden="true">
          <label htmlFor="website">Website</label>
          <input
            id="website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={values.website || ""}
            onChange={(event) => handleChange("website", event.target.value)}
          />
        </div>

        <div>
          <label htmlFor={nameId} className="mb-2 block text-sm font-medium text-[#e5eefc]">
            Name
          </label>
          <input
            id={nameId}
            name="name"
            type="text"
            autoComplete="name"
            required
            value={values.name}
            onChange={(event) => handleChange("name", event.target.value)}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? `${nameId}-error` : undefined}
            className="w-full rounded-2xl border border-white/10 bg-[#0f172a] px-4 py-3 text-[#f8fafc] transition-colors placeholder:text-[#64748b] hover:border-[#2563eb]/50 focus:border-[#60a5fa] focus:bg-[#111b2f] focus:outline-none"
            placeholder="Your name"
          />
          {errors.name ? (
            <p id={`${nameId}-error`} className="mt-2 text-sm text-[#fca5a5]">
              {errors.name}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor={emailId} className="mb-2 block text-sm font-medium text-[#e5eefc]">
            Email
          </label>
          <input
            id={emailId}
            name="email"
            type="email"
            autoComplete="email"
            required
            value={values.email}
            onChange={(event) => handleChange("email", event.target.value)}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? `${emailId}-error` : undefined}
            className="w-full rounded-2xl border border-white/10 bg-[#0f172a] px-4 py-3 text-[#f8fafc] transition-colors placeholder:text-[#64748b] hover:border-[#2563eb]/50 focus:border-[#60a5fa] focus:bg-[#111b2f] focus:outline-none"
            placeholder="you@example.com"
          />
          {errors.email ? (
            <p id={`${emailId}-error`} className="mt-2 text-sm text-[#fca5a5]">
              {errors.email}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor={messageId} className="mb-2 block text-sm font-medium text-[#e5eefc]">
            Message
          </label>
          <textarea
            id={messageId}
            name="message"
            required
            rows={6}
            value={values.message}
            onChange={(event) => handleChange("message", event.target.value)}
            aria-invalid={Boolean(errors.message)}
            aria-describedby={errors.message ? `${messageId}-error` : undefined}
            className="w-full rounded-2xl border border-white/10 bg-[#0f172a] px-4 py-3 text-[#f8fafc] transition-colors placeholder:text-[#64748b] hover:border-[#2563eb]/50 focus:border-[#60a5fa] focus:bg-[#111b2f] focus:outline-none"
            placeholder="Tell us what you need help with"
          />
          {errors.message ? (
            <p id={`${messageId}-error`} className="mt-2 text-sm text-[#fca5a5]">
              {errors.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[#94a3b8]">
          We will only use this to respond to your request.
        </p>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center rounded-2xl border border-[#3b82f6]/60 bg-[#3b82f6] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_-20px_rgba(59,130,246,0.8)] transition hover:bg-[#60a5fa] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Sending..." : "Send message"}
        </button>
      </div>
    </form>
  );
}
