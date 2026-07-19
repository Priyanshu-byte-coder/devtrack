'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Target,
  Plus,
  Trash2,
  Copy,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface Milestone {
  id: string;
  title: string;
  description: string;
  target_value: number;
  current_value: number;
  unit: string;
  target_date: string;
  created_at: string;
  category: 'commits' | 'streak' | 'projects' | 'custom';
}

type MilestoneStatus = 'completed' | 'on-track' | 'at-risk' | 'behind';

const CATEGORY_OPTIONS = [
  { value: 'commits', label: 'Commits', icon: '📝' },
  { value: 'streak', label: 'Streak Days', icon: '🔥' },
  { value: 'projects', label: 'Projects', icon: '🚀' },
  { value: 'custom', label: 'Custom', icon: '🎯' },
];

function getStatus(milestone: Milestone): MilestoneStatus {
  const progress = milestone.current_value / milestone.target_value;
  if (progress >= 1) return 'completed';

  const now = Date.now();
  const created = new Date(milestone.created_at).getTime();
  const target = new Date(milestone.target_date).getTime();
  const totalDuration = target - created;
  const elapsed = now - created;
  const expectedProgress = totalDuration > 0 ? elapsed / totalDuration : 0;

  if (now > target) return 'behind';
  if (progress >= expectedProgress * 0.9) return 'on-track';
  if (progress >= expectedProgress * 0.6) return 'at-risk';
  return 'behind';
}

function getForecastDate(milestone: Milestone): string | null {
  const { current_value, target_value, created_at } = milestone;
  if (current_value <= 0) return null;

  const elapsed = Date.now() - new Date(created_at).getTime();
  const rate = current_value / elapsed;
  const remaining = target_value - current_value;
  if (rate <= 0) return null;

  const msNeeded = remaining / rate;
  const forecastDate = new Date(Date.now() + msNeeded);
  return forecastDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatusBadge({ status }: { status: MilestoneStatus }) {
  const config = {
    completed: { label: 'Completed', color: '#10b981', icon: <CheckCircle2 size={12} /> },
    'on-track': { label: 'On Track', color: '#6366f1', icon: <TrendingUp size={12} /> },
    'at-risk': { label: 'At Risk', color: '#f59e0b', icon: <AlertTriangle size={12} /> },
    behind: { label: 'Behind', color: '#ef4444', icon: <Clock size={12} /> },
  }[status];

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '2px 8px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600,
      background: `${config.color}20`, color: config.color, border: `1px solid ${config.color}40`,
    }}>
      {config.icon} {config.label}
    </span>
  );
}

export default function MilestonePlanner() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '', description: '', targetValue: '', currentValue: '0',
    unit: '', targetDate: '', category: 'custom' as Milestone['category'],
  });

  const loadMilestones = useCallback(async () => {
    try {
      const res = await fetch('/api/milestones');
      if (!res.ok) return;
      const data = await res.json();
      setMilestones(data.milestones ?? []);
    } catch {
      // silently ignore network errors on initial load
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMilestones();
  }, [loadMilestones]);

  const handleAdd = useCallback(async () => {
    if (!form.title || !form.targetValue || !form.targetDate) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/milestones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          targetValue: Number(form.targetValue),
          currentValue: Number(form.currentValue) || 0,
          unit: form.unit || CATEGORY_OPTIONS.find(c => c.value === form.category)?.label || 'units',
          targetDate: form.targetDate,
          category: form.category,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? 'Failed to create milestone.');
        return;
      }
      const data = await res.json();
      setMilestones(prev => [data.milestone, ...prev]);
      setForm({ title: '', description: '', targetValue: '', currentValue: '0', unit: '', targetDate: '', category: 'custom' });
      setShowForm(false);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [form]);

  const handleIncrement = useCallback(async (id: string) => {
    const milestone = milestones.find(m => m.id === id);
    if (!milestone || milestone.current_value >= milestone.target_value) return;
    const next = milestone.current_value + 1;
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, current_value: next } : m));
    try {
      await fetch(`/api/milestones/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentValue: next }),
      });
    } catch {
      setMilestones(prev => prev.map(m => m.id === id ? { ...m, current_value: milestone.current_value } : m));
    }
  }, [milestones]);

  const handleDelete = useCallback(async (id: string) => {
    setMilestones(prev => prev.filter(m => m.id !== id));
    try {
      await fetch(`/api/milestones/${id}`, { method: 'DELETE' });
    } catch {
      loadMilestones();
    }
  }, [loadMilestones]);

  const handleDuplicate = useCallback(async (id: string) => {
    const milestone = milestones.find(m => m.id === id);
    if (!milestone) return;
    try {
      const res = await fetch('/api/milestones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${milestone.title} (Copy)`,
          description: milestone.description,
          targetValue: milestone.target_value,
          currentValue: milestone.current_value,
          unit: milestone.unit,
          targetDate: milestone.target_date,
          category: milestone.category,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMilestones(prev => [data.milestone, ...prev]);
      }
    } catch {
      loadMilestones();
    }
  }, [milestones, loadMilestones]);

  const statusCounts = milestones.reduce((acc, m) => {
    acc[getStatus(m)] = (acc[getStatus(m)] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Target size={20} style={{ color: '#6366f1' }} />
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
            Milestone Planner
          </h2>
          {milestones.length > 0 && (
            <span style={{ fontSize: '0.75rem', background: '#6366f120', color: '#6366f1', padding: '2px 8px', borderRadius: '999px', fontWeight: 600 }}>
              {milestones.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 14px', borderRadius: '8px', border: 'none',
            background: '#6366f1', color: '#fff', fontSize: '0.8rem',
            fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Plus size={14} /> Add Milestone
        </button>
      </div>

      {/* Summary chips */}
      {milestones.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {Object.entries(statusCounts).map(([status, count]) => (
            <StatusBadge key={status} status={status as MilestoneStatus} />
          ))}
        </div>
      )}

      {/* Error message */}
      {error && (
        <p role="alert" style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: '12px' }}>{error}</p>
      )}

      {/* Add form */}
      {showForm && (
        <div style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', display: 'block', marginBottom: '4px' }}>Title *</label>
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Reach 500 commits"
                maxLength={100}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: '0.875rem', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', display: 'block', marginBottom: '4px' }}>Category</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value as Milestone['category'] }))}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: '0.875rem' }}
              >
                {CATEGORY_OPTIONS.map(c => (
                  <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', display: 'block', marginBottom: '4px' }}>Target Date *</label>
              <input
                type="date"
                value={form.targetDate}
                onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: '0.875rem' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', display: 'block', marginBottom: '4px' }}>Target Value *</label>
              <input
                type="number"
                value={form.targetValue}
                onChange={e => setForm(f => ({ ...f, targetValue: e.target.value }))}
                placeholder="100"
                min={1}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: '0.875rem' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', display: 'block', marginBottom: '4px' }}>Current Value</label>
              <input
                type="number"
                value={form.currentValue}
                onChange={e => setForm(f => ({ ...f, currentValue: e.target.value }))}
                placeholder="0"
                min={0}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: '0.875rem' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--foreground)', fontSize: '0.8rem', cursor: 'pointer' }}>
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={saving}
              style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#6366f1', color: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
            >
              {saving ? 'Saving…' : 'Add Milestone'}
            </button>
          </div>
        </div>
      )}

      {/* Milestone list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
          Loading milestones…
        </div>
      ) : milestones.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
          <Target size={32} style={{ opacity: 0.3, margin: '0 auto 8px' }} />
          <p style={{ margin: 0 }}>No milestones yet. Create one to start tracking!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {milestones.map(m => {
            const status = getStatus(m);
            const pct = Math.min(Math.round((m.current_value / m.target_value) * 100), 100);
            const forecast = getForecastDate(m);
            const isExpanded = expanded === m.id;
            const statusColor = { completed: '#10b981', 'on-track': '#6366f1', 'at-risk': '#f59e0b', behind: '#ef4444' }[status];

            return (
              <div key={m.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '1.1rem' }}>{CATEGORY_OPTIONS.find(c => c.value === m.category)?.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--foreground)' }}>{m.title}</span>
                      <StatusBadge status={status} />
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '2px' }}>
                      {m.current_value}/{m.target_value} {m.unit} · Due {new Date(m.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={() => handleIncrement(m.id)}
                      disabled={status === 'completed'}
                      style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--foreground)', fontSize: '0.75rem', cursor: status === 'completed' ? 'not-allowed' : 'pointer', opacity: status === 'completed' ? 0.4 : 1 }}
                    >
                      +1
                    </button>
                    <button onClick={() => setExpanded(isExpanded ? null : m.id)} style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', cursor: 'pointer' }}>
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button
                      onClick={() => handleDuplicate(m.id)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: 'transparent',
                        color: 'var(--foreground)',
                        cursor: 'pointer'
                      }}
                      title="Duplicate milestone"
                    >
                      <Copy size={14} />
                    </button>
                    <button onClick={() => handleDelete(m.id)} style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid transparent', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: statusColor, borderRadius: '999px', transition: 'width 0.4s ease' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>{pct}% complete</span>
                  {forecast && status !== 'completed' && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>
                      📅 Forecast: {forecast}
                    </span>
                  )}
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
                    {m.description && <p style={{ margin: '0 0 6px' }}>{m.description}</p>}
                    <p style={{ margin: 0 }}>Created: {new Date(m.created_at).toLocaleDateString()}</p>
                    {status === 'completed' && <p style={{ margin: '4px 0 0', color: '#10b981', fontWeight: 600 }}>🎉 Milestone achieved!</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
