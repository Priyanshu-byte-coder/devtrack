import sys

filepath = "src/components/ProjectMilestones.tsx"
with open(filepath, "r") as f:
    content = f.read()

# Replace states
old_states = """  const [milestoneForm, setMilestoneForm] = useState({ name: '', description: '', dueDate: '' });
  
  const [taskInputs, setTaskInputs] = useState<Record<string, string>>({});"""

new_states = """  const [milestoneForm, setMilestoneForm] = useState({ name: '', description: '', dueDate: '' });
  
  const [taskInputs, setTaskInputs] = useState<Record<string, string>>({});
  const [taskRecurrenceInputs, setTaskRecurrenceInputs] = useState<Record<string, 'none' | 'daily' | 'weekly' | 'monthly' | 'custom'>>({});
  const [taskRecurrenceIntervals, setTaskRecurrenceIntervals] = useState<Record<string, number>>({});
  const [taskRecurrenceEnds, setTaskRecurrenceEnds] = useState<Record<string, number>>({});"""

content = content.replace(old_states, new_states)

# Replace handleAddTask
old_add_task = """  const handleAddTask = async (milestoneId: string) => {
    const title = taskInputs[milestoneId]?.trim();
    if (!title) return;

    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, milestoneId })
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
    }
  };"""

new_add_task = """  const handleAddTask = async (milestoneId: string) => {
    const title = taskInputs[milestoneId]?.trim();
    if (!title) return;

    const recType = taskRecurrenceInputs[milestoneId];
    let recurrence_config = null;
    if (recType && recType !== 'none') {
      recurrence_config = {
        type: recType,
        intervalDays: recType === 'custom' ? (taskRecurrenceIntervals[milestoneId] || 1) : undefined,
        endsAfter: taskRecurrenceEnds[milestoneId] || undefined
      };
    }

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
  };"""

content = content.replace(old_add_task, new_add_task)

# Replace UI for task addition
old_ui = """                  <div style={{ display: 'flex', gap: '8px' }}>
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
                  </div>"""

new_ui = """                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                  </div>"""

content = content.replace(old_ui, new_ui)

with open(filepath, "w") as f:
    f.write(content)

print("Updated ProjectMilestones.tsx")
