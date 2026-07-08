"use client";

import { useCallback, useEffect, useState } from "react";

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[];
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface WebhookDelivery {
  id: string;
  event: string;
  status_code: number | null;
  success: boolean;
  error_message: string | null;
  delivered_at: string;
  payload?: Record<string, unknown>;
}

const AVAILABLE_EVENTS = [
  { value: "goal.completed", label: "Goal Completed" },
  { value: "goal.created", label: "Goal Created" },
  { value: "streak.milestone", label: "Streak Milestone" },
  { value: "daily.summary", label: "Daily Summary" },
  { value: "weekly.summary", label: "Weekly Summary" },
  { value: "metrics.updated", label: "Metrics Updated" },
];

export default function WebhookManager() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [creatingError, setCreatingError] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formEvents, setFormEvents] = useState<string[]>([]);

  const [selectedWebhook, setSelectedWebhook] = useState<string | null>(null);
  const [webhookDetails, setWebhookDetails] = useState<{
    config: WebhookConfig;
    deliveries: WebhookDelivery[];
  } | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const [expandedDeliveryId, setExpandedDeliveryId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryResult, setRetryResult] = useState<{
    id: string;
    success: boolean;
    message: string;
  } | null>(null);

  async function handleRetry(webhookId: string, deliveryId: string) {
    setRetryingId(deliveryId);
    setRetryResult(null);

    try {
      const res = await fetch(
        `/api/webhooks/custom/${webhookId}/deliveries/${deliveryId}/retry`,
        { method: "POST" }
      );
      const data = await res.json();
      setRetryResult({
        id: deliveryId,
        success: data.success,
        message: data.success
          ? "Re-delivery successful"
          : data.error || `Failed (HTTP ${data.statusCode})`,
      });

      // Refresh deliveries history
      const detailsRes = await fetch(`/api/webhooks/custom/${webhookId}`);
      if (detailsRes.ok) {
        const detailsData = await detailsRes.json();
        setWebhookDetails({
          config: detailsData.webhook,
          deliveries: detailsData.recentDeliveries || [],
        });
      }
    } catch {
      setRetryResult({
        id: deliveryId,
        success: false,
        message: "Failed to retry delivery",
      });
    } finally {
      setRetryingId(null);
    }
  }

  const loadWebhooks = useCallback(async () => {
    try {
      const res = await fetch("/api/webhooks/custom");
      if (res.ok) {
        const data = await res.json();
        setWebhooks(data.webhooks || []);
      }
    } catch {
      setWebhooks([]);
    }
  }, []);

  useEffect(() => {
    loadWebhooks().finally(() => setLoading(false));
  }, [loadWebhooks]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreatingError(null);
    setNewSecret(null);

    try {
      const res = await fetch("/api/webhooks/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          url: formUrl,
          events: formEvents,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create webhook");
      }

      setNewSecret(data.secretKey);
      setFormName("");
      setFormUrl("");
      setFormEvents([]);
      await loadWebhooks();
    } catch (err) {
      setCreatingError(err instanceof Error ? err.message : "Failed to create webhook");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this webhook?")) {
      return;
    }

    try {
      await fetch(`/api/webhooks/custom/${id}`, { method: "DELETE" });
      await loadWebhooks();
      if (selectedWebhook === id) {
        setSelectedWebhook(null);
        setWebhookDetails(null);
      }
    } catch {
      console.error("Failed to delete webhook");
    }
  }

  async function handleToggleEnabled(id: string, currentEnabled: boolean) {
    try {
      const res = await fetch(`/api/webhooks/custom/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_enabled: !currentEnabled }),
      });

      if (res.ok) {
        await loadWebhooks();
        if (selectedWebhook === id && webhookDetails) {
          const updated = await res.json();
          setWebhookDetails({
            ...webhookDetails,
            config: updated.webhook,
          });
        }
      }
    } catch {
      console.error("Failed to toggle webhook");
    }
  }

  async function viewDetails(id: string) {
    setSelectedWebhook(id);
    setDetailsLoading(true);
    setTestResult(null);
    setExpandedDeliveryId(null);
    setRetryResult(null);

    try {
      const res = await fetch(`/api/webhooks/custom/${id}`);
      if (res.ok) {
        const data = await res.json();
        setWebhookDetails({
          config: data.webhook,
          deliveries: data.recentDeliveries || [],
        });
      }
    } catch {
      setWebhookDetails(null);
    } finally {
      setDetailsLoading(false);
    }
  }

  async function handleTest(id: string) {
    setTestingId(id);
    setTestResult(null);

    try {
      const res = await fetch(`/api/webhooks/custom/${id}/test`, {
        method: "POST",
      });

      const data = await res.json();
      setTestResult({
        success: data.success,
        message: data.success
          ? "Test delivery successful"
          : data.error || `Failed (HTTP ${data.statusCode})`,
      });

      if (selectedWebhook === id && webhookDetails) {
        viewDetails(id);
      }
    } catch {
      setTestResult({
        success: false,
        message: "Failed to send test",
      });
    } finally {
      setTestingId(null);
    }
  }

  async function handleRotateSecret(id: string) {
    if (!confirm("Rotate secret key? Your endpoint will need to use the new key.")) {
      return;
    }

    try {
      const res = await fetch(`/api/webhooks/custom/${id}/rotate-secret`, {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        setNewSecret(data.secretKey);
        if (selectedWebhook === id) {
          viewDetails(id);
        }
      }
    } catch {
      console.error("Failed to rotate secret");
    }
  }

  function toggleEvent(event: string) {
    setFormEvents((current) =>
      current.includes(event)
        ? current.filter((e) => e !== event)
        : [...current, event]
    );
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getEventLabel(eventValue: string): string {
    return AVAILABLE_EVENTS.find((e) => e.value === eventValue)?.label || eventValue;
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="h-6 w-40 bg-[var(--card-muted)] rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 bg-[var(--card-muted)] rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-[var(--card-foreground)]">
            Custom Webhooks
          </h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Trigger external events from your DevTrack metrics
          </p>
        </div>

        <button
          onClick={() => {
            setShowCreateForm(!showCreateForm);
            setNewSecret(null);
            setCreatingError(null);
          }}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          {showCreateForm ? "Cancel" : "Add Webhook"}
        </button>
      </div>

      {newSecret && (
        <div className="mb-6 rounded-lg border border-[var(--success)]/30 bg-[var(--success)]/10 p-4">
          <p className="text-sm font-semibold text-[var(--success)]">Webhook Created!</p>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Save this secret key - it will not be shown again:
          </p>
          <code className="mt-2 block rounded bg-[var(--control)] p-2 font-mono text-xs break-all">
            {newSecret}
          </code>
        </div>
      )}

      {showCreateForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--control)] p-4 space-y-4"
        >
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              Name
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="My Dashboard Integration"
              required
              disabled={creating}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              Webhook URL
            </label>
            <input
              type="url"
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
              placeholder="https://your-server.com/webhook"
              required
              disabled={creating}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
              Events
            </label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {AVAILABLE_EVENTS.map((event) => (
                <label
                  key={event.value}
                  className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all text-sm ${
                    formEvents.includes(event.value)
                      ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--foreground)]"
                      : "border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--accent)]/50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formEvents.includes(event.value)}
                    onChange={() => toggleEvent(event.value)}
                    disabled={creating}
                    className="sr-only"
                  />
                  <span
                    className={`h-4 w-4 rounded border flex items-center justify-center ${
                      formEvents.includes(event.value)
                        ? "bg-[var(--accent)] border-[var(--accent)]"
                        : "border-[var(--border)]"
                    }`}
                  >
                    {formEvents.includes(event.value) && (
                      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span>{event.label}</span>
                </label>
              ))}
            </div>
          </div>

          {creatingError && (
            <p className="text-sm text-[var(--destructive)]">{creatingError}</p>
          )}

          <button
            type="submit"
            disabled={creating || formEvents.length === 0}
            className="w-full rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {creating ? "Creating..." : "Create Webhook"}
          </button>
        </form>
      )}

      {webhooks.length === 0 ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--control)] p-6 text-center">
          <p className="text-sm text-[var(--muted-foreground)]">
            No webhooks configured yet
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((webhook) => (
            <div
              key={webhook.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--control)] p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-[var(--foreground)] truncate">
                      {webhook.name}
                    </h3>
                    {!webhook.is_enabled && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--muted-foreground)]/20 text-[var(--muted-foreground)]">
                        Disabled
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)] truncate">
                    {webhook.url}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {webhook.events.map((event) => (
                      <span
                        key={event}
                        className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)]"
                      >
                        {getEventLabel(event)}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleToggleEnabled(webhook.id, webhook.is_enabled)}
                    className="p-2 rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                    title={webhook.is_enabled ? "Disable webhook" : "Enable webhook"}
                  >
                    {webhook.is_enabled ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => viewDetails(webhook.id)}
                    className="p-2 rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                    title="View details"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleTest(webhook.id)}
                    disabled={testingId === webhook.id}
                    className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)]/10 transition-colors disabled:opacity-60"
                    title="Send test payload"
                  >
                    {testingId === webhook.id ? "Testing..." : "Test"}
                  </button>
                  <button
                    onClick={() => handleDelete(webhook.id)}
                    className="p-2 rounded-lg border border-[var(--destructive)]/30 text-[var(--destructive)] hover:bg-[var(--destructive)]/10 transition-colors"
                    title="Delete webhook"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {testResult && (
        <div
          className={`mt-4 rounded-lg border p-4 ${
            testResult.success
              ? "border-[var(--success)]/30 bg-[var(--success)]/10 text-[var(--success)]"
              : "border-[var(--destructive)]/30 bg-[var(--destructive)]/10 text-[var(--destructive)]"
          }`}
        >
          {testResult.message}
        </div>
      )}

      {detailsLoading && (
        <div className="mt-4 p-4 rounded-lg border border-[var(--border)]">
          <div className="h-20 bg-[var(--card-muted)] rounded animate-pulse" />
        </div>
      )}

      {selectedWebhook && webhookDetails && !detailsLoading && (
        <div className="mt-6 rounded-lg border border-[var(--border)] p-4">
          <h3 className="font-semibold text-[var(--card-foreground)] mb-4">
            Webhook Details: {webhookDetails.config.name}
          </h3>

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => handleTest(selectedWebhook)}
              disabled={testingId === selectedWebhook}
              className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-sm font-medium text-white hover:opacity-90 disabled:opacity-60 transition-opacity"
            >
              {testingId === selectedWebhook ? "Sending..." : "Send Test"}
            </button>
            <button
              onClick={() => handleRotateSecret(selectedWebhook)}
              className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm font-medium text-[var(--foreground)] hover:bg-[var(--control)] transition-colors"
            >
              Rotate Secret
            </button>
          </div>

          {webhookDetails.deliveries.length > 0 ? (
            <div>
              <h4 className="text-sm font-medium text-[var(--muted-foreground)] mb-2">
                Recent Deliveries
              </h4>
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {webhookDetails.deliveries.map((delivery) => {
                  const isExpanded = expandedDeliveryId === delivery.id;
                  return (
                    <div
                      key={delivery.id}
                      onClick={() => setExpandedDeliveryId(isExpanded ? null : delivery.id)}
                      className="group flex flex-col rounded-lg border border-[var(--border)] bg-[var(--control)] hover:border-[var(--accent)]/50 transition-colors cursor-pointer overflow-hidden"
                    >
                      {/* Summary Row */}
                      <div className="flex items-center gap-3 p-3 text-sm">
                        <span
                          className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                            delivery.success ? "bg-emerald-500" : "bg-red-500"
                          }`}
                        />
                        <span className="flex-1 font-medium text-[var(--foreground)] truncate">
                          {getEventLabel(delivery.event)}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                            delivery.success
                              ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-red-500/10 text-red-500"
                          }`}
                        >
                          {delivery.status_code || "Fail"}
                        </span>
                        <span className="text-[var(--muted-foreground)] text-xs hidden sm:inline">
                          {formatDate(delivery.delivered_at)}
                        </span>
                        <svg
                          className={`h-4 w-4 text-[var(--muted-foreground)] transition-transform duration-200 ${
                            isExpanded ? "rotate-90" : ""
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>

                      {/* Expandable Details Container */}
                      {isExpanded && (
                        <div
                          className="border-t border-[var(--border)] bg-[var(--background)]/30 p-3 space-y-3"
                          onClick={(e) => e.stopPropagation()} // Prevent collapse when clicking inside details
                        >
                          {delivery.error_message && (
                            <div>
                              <span className="text-xs font-semibold text-red-500 block mb-1">
                                Delivery Error
                              </span>
                              <div className="rounded bg-red-500/10 p-2 text-xs font-mono text-red-500 border border-red-500/20">
                                {delivery.error_message}
                              </div>
                            </div>
                          )}

                          {delivery.payload && (
                            <div>
                              <span className="text-xs font-semibold text-[var(--muted-foreground)] block mb-1">
                                Request Payload
                              </span>
                              <pre className="rounded border border-[var(--border)] bg-[var(--control)] p-3 text-xs font-mono overflow-x-auto text-[var(--foreground)] max-h-48">
                                {JSON.stringify(delivery.payload, null, 2)}
                              </pre>
                            </div>
                          )}

                          <div className="flex items-center gap-3 pt-1">
                            <button
                              type="button"
                              onClick={() => handleRetry(selectedWebhook, delivery.id)}
                              disabled={retryingId === delivery.id || !webhookDetails.config.is_enabled}
                              className="px-2.5 py-1 text-xs font-medium bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded flex items-center gap-1.5 transition-opacity"
                            >
                              {retryingId === delivery.id ? (
                                <>
                                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                  Retrying...
                                </>
                              ) : (
                                <>
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 6.571M12 18.25V21" />
                                  </svg>
                                  Retry Delivery
                                </>
                              )}
                            </button>

                            {retryResult && retryResult.id === delivery.id && (
                              <span
                                className={`text-xs font-semibold ${
                                  retryResult.success ? "text-emerald-500" : "text-red-500"
                                }`}
                              >
                                {retryResult.success ? "✓ " : "✗ "}
                                {retryResult.message}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted-foreground)]">
              No deliveries yet
            </p>
          )}
        </div>
      )}
    </div>
  );
}
