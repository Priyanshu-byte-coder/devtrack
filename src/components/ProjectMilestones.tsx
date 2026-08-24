'use client';

import { useState, useEffect } from 'react';
import { Target, Plus, Trash2, CheckCircle2, Circle, Repeat } from 'lucide-react';
import { Milestone, Task } from '@/types/project-milestone';

export default function ProjectMilestones() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [milestoneForm, setMilestoneForm] = useState({ name: '', description: '', dueDate: '' });
  
  const [taskInputs, setTaskInputs] = useState<Record<string, string>>({});
  const [taskRecurrenceInputs, setTaskRecurrenceInputs] = useState<Record<string, 'none' | 'daily' | 'weekly' | 'monthly' | 'custom'>>({});
  const [taskRecurrenceIntervals, setTaskRecurrenceIntervals] = useState<Record<string, number>>({});
  const [taskRecurrenceEnds, setTaskRecurrenceEnds] = useState<Record<string, number>>({});

  useEffect(() => {
    setIsClient(true);
    Promise.all([
      fetch('/api/milestones').then(r => r.json()),
      fetch('/api/tasks').then(r => r.json())
    ]).then(([mils, tsks]) => {
      setMilestones(Array.isArray(mils) ? mils : []);
      setTasks(Array.isArray(tsks) ? tsks : []);
      setLoading(false);
    }).catch(e => {
      console.error(e);
      setLoading(false);
    });
  }, []);

  if (!isClient) return null;

  const handleCreateMilestone = async () => {
    if (!milestoneForm.name || !milestoneForm.dueDate) return;
    
    const res = await fetch('/api/milestones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: milestoneForm.name,
        description: milestoneForm.description,
        dueDate: milestoneForm.dueDate,
        taskIds: []
      })
    });
    
    if (res.ok) {
      const newMilestone = await res.json();
      setMilestones(prev => [newMilestone, ...prev]);
      setMilestoneForm({ name: '', description: '', dueDate: '' });
      setShowMilestoneForm(false);
    }
  };

  const handleDeleteMilestone = async (id: string) => {
    const res = await fetch(`/api/milestones/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setMilestones(prev => prev.filter(m => m.id !== id));
    }
  };

  const handleAddTask = async (milestoneId: string) => {
    const title = taskInputs[milestoneId]?.trim();
    if (!title) return;

    const recType = taskRecurrenceInputs[milestoneId];
    const recurrence_config = (recType && recType !== 'none') ? {
      type: recType,
      intervalDays: recType === 'custom' ? (taskRecurrenceIntervals[milestoneId] || 1) : undefined,
      endsAfter: taskRecurrenceEnds[milestoneId] || undefined
    } : null;

    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, milestoneId, recurrence_config })
    });

    if (res.ok) {
      const newTask = await res.json();
      setTasks(prev => [...prev, newTask]);
      setMilestones(prev => prev.map(m => {
        if (m.id === milestoneId) {
          return { ...m, taskIds: [...(m.taskIds || []), newTask.id] };
        }
        return m;
      }));
      setTaskInputs(prev => ({ ...prev, [milestoneId]: '' }));
      setTaskRecurrenceInputs(prev => ({ ...prev, [milestoneId]: 'none' }));
      setTaskRecurrenceIntervals(prev => ({ ...prev, [milestoneId]: 1 }));
      setTaskRecurrenceEnds(prev => ({ ...prev, [milestoneId]: 0 }));
    }
  };

  const handleToggleTask = async (taskId: string, currentCompleted: boolean) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: !currentCompleted } : t));
    
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !currentCompleted })
    });
    
    if (!res.ok) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: currentCompleted } : t));
    }
  };

  const handleDeleteTask = async (milestoneId: string, taskId: string) => {
    const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
    if (res.ok) {
      setTasks(prev => prev.filter(t => t.id !== taskId));
      setMilestones(prev => prev.map(m => {
        if (m.id === milestoneId) {
          return { ...m, taskIds: (m.taskIds || []).filter(id => id !== taskId) };
        }
        return m;
      }));
    }
  };

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Target size={20} style={{ color: '#6366f1' }} />
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
            Project Milestones
          </h2>
        </div>
        <button
          onClick={() => setShowMilestoneForm(v => !v)}
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

      {showMilestoneForm && (
        <div style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', marginBottom: '10px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', display: 'block', marginBottom: '4px' }}>Name *</label>
              <input
                value={milestoneForm.name}
                onChange={e => setMilestoneForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. v1.0 Release"
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: '0.875rem' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', display: 'block', marginBottom: '4px' }}>Description</label>
              <input
                value={milestoneForm.description}
                onChange={e => setMilestoneForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional description"
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: '0.875rem' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', display: 'block', marginBottom: '4px' }}>Due Date *</label>
              <input
                type="date"
                value={milestoneForm.dueDate}
                onChange={e => setMilestoneForm(f => ({ ...f, dueDate: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: '0.875rem' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowMilestoneForm(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--foreground)', fontSize: '0.8rem', cursor: 'pointer' }}>
              Cancel
            </button>
            <button
              onClick={handleCreateMilestone}
              disabled={!milestoneForm.name || !milestoneForm.dueDate}
              style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#6366f1', color: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', opacity: (!milestoneForm.name || !milestoneForm.dueDate) ? 0.6 : 1 }}
            >
              Add Milestone
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
          Loading milestones...
        </div>
      ) : milestones.length === 0 ? (
         <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
          <Target size={32} style={{ opacity: 0.3, margin: '0 auto 8px' }} />
          <p style={{ margin: 0 }}>No project milestones yet. Create one to start tracking!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {milestones.map(m => {
            const mTasks = (m.taskIds || []).map(id => tasks.find(t => t.id === id)).filter((t): t is Task => !!t);
            const totalTasks = mTasks.length;
            const completedTasks = mTasks.filter(t => t.completed).length;
            const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

            return (
              <div key={m.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 600, color: 'var(--foreground)' }}>{m.name}</h3>
                    {m.description && <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'var(--muted-foreground)' }}>{m.description}</p>}
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>Due: {new Date(m.dueDate).toLocaleDateString()}</span>
                  </div>
                  <button onClick={() => handleDeleteMilestone(m.id)} style={{ padding: '4px', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                    <Trash2 size={16} />
                  </button>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--muted-foreground)', marginBottom: '4px' }}>
                    <span>Progress</span>
                    <span>{progress}% ({completedTasks}/{totalTasks})</span>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progress}%`, background: progress === 100 ? '#10b981' : '#6366f1', borderRadius: '999px', transition: 'width 0.3s ease' }} />
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                  <h4 style={{ fontSize: '0.85rem', margin: '0 0 8px 0', color: 'var(--foreground)' }}>Tasks</h4>
                  {mTasks.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', fontStyle: 'italic', margin: '0 0 8px 0' }}>No tasks linked.</p>
                  ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {mTasks.map(task => (
                        <li key={task.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '0.85rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => handleToggleTask(task.id, task.completed)}>
                            {task.completed ? <CheckCircle2 size={16} color="#10b981" /> : <Circle size={16} color="var(--muted-foreground)" />}
                            <span style={{ textDecoration: task.completed ? 'line-through' : 'none', color: task.completed ? 'var(--muted-foreground)' : 'var(--foreground)' }}>
                              {task.title}
                              {task.recurrence_config && <Repeat size={12} style={{ display: 'inline', marginLeft: '4px', opacity: 0.5 }} />}
                            </span>
                          </div>
                          <button onClick={() => handleDeleteTask(m.id, task.id)} style={{ padding: '2px', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', opacity: 0.7 }}>
                            <Trash2 size={12} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="New task title..."
                        value={taskInputs[m.id] || ''}
                        onChange={e => setTaskInputs(prev => ({ ...prev, [m.id]: e.target.value }))}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleAddTask(m.id);
                        }}
                        style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: '0.8rem' }}
                      />
                      <button
                        onClick={() => handleAddTask(m.id)}
                        disabled={!taskInputs[m.id]?.trim()}
                        style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: 'rgba(99,102,241,0.1)', color: '#6366f1', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', opacity: !taskInputs[m.id]?.trim() ? 0.5 : 1 }}
                      >
                        Add
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                      <select 
                        value={taskRecurrenceInputs[m.id] || 'none'}
                        onChange={e => setTaskRecurrenceInputs(prev => ({ ...prev, [m.id]: e.target.value as any }))}
                        style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)' }}
                      >
                        <option value="none">No Recurrence</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="custom">Custom</option>
                      </select>
                      
                      {taskRecurrenceInputs[m.id] === 'custom' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>Every</span>
                          <input 
                            type="number" min="1" max="365"
                            value={taskRecurrenceIntervals[m.id] || 1}
                            onChange={e => setTaskRecurrenceIntervals(prev => ({ ...prev, [m.id]: parseInt(e.target.value) || 1 }))}
                            style={{ width: '50px', padding: '2px 4px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)' }}
                          />
                          <span>days</span>
                        </div>
                      )}

                      {(taskRecurrenceInputs[m.id] && taskRecurrenceInputs[m.id] !== 'none') && (
                         <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
                          <span>Ends after (optional):</span>
                          <input 
                            type="number" min="1" max="100" placeholder="∞"
                            value={taskRecurrenceEnds[m.id] || ''}
                            onChange={e => setTaskRecurrenceEnds(prev => ({ ...prev, [m.id]: parseInt(e.target.value) || 0 }))}
                            style={{ width: '50px', padding: '2px 4px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)' }}
                          />
                          <span>times</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
