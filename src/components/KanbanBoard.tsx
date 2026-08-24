'use client';

import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
  DropAnimation
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task } from '@/types/project-milestone';
import { KanbanSquare, Plus, MoreHorizontal } from 'lucide-react';

const COLUMNS = [
  { id: 'todo', title: 'To Do', color: '#64748b' },
  { id: 'in-progress', title: 'In Progress', color: '#3b82f6' },
  { id: 'done', title: 'Done', color: '#10b981' }
];

function SortableTask({ task }: { task: Task }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id, data: { type: 'Task', task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`p-3 rounded-lg border border-white/5 cursor-grab active:cursor-grabbing mb-2 ${
        isDragging ? 'bg-indigo-500/10' : 'bg-white/5 hover:bg-white/10'
      }`}
    >
      <div className="text-sm font-medium text-white mb-1">{task.title}</div>
      <div className="flex gap-2 text-xs text-white/50">
        <span className={`px-2 py-0.5 rounded-full bg-white/5 ${
          task.priority === 'high' ? 'text-red-400' : task.priority === 'medium' ? 'text-yellow-400' : 'text-green-400'
        }`}>
          {task.priority}
        </span>
        {task.dueDate && <span>{new Date(task.dueDate).toLocaleDateString()}</span>}
      </div>
    </div>
  );
}

export default function KanbanBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  useEffect(() => {
    fetch('/api/tasks')
      .then(res => res.json())
      .then(data => {
        // Sort by order_index primarily
        const sorted = (Array.isArray(data) ? data : []).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
        setTasks(sorted);
        setLoading(false);
      });
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const getTasksByStatus = (status: string) => {
    return tasks.filter(t => (t.status || (t.completed ? 'done' : 'todo')) === status);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find(t => t.id === active.id);
    if (task) setActiveTask(task);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveTask = active.data.current?.type === 'Task';
    const isOverTask = over.data.current?.type === 'Task';
    const isOverColumn = over.data.current?.type === 'Column';

    if (!isActiveTask) return;

    // Dropping a task over another task
    if (isActiveTask && isOverTask) {
      setTasks(prev => {
        const activeIndex = prev.findIndex(t => t.id === activeId);
        const overIndex = prev.findIndex(t => t.id === overId);

        if (prev[activeIndex].status !== prev[overIndex].status) {
          const newTasks = [...prev];
          newTasks[activeIndex] = { ...newTasks[activeIndex], status: newTasks[overIndex].status };
          return arrayMove(newTasks, activeIndex, overIndex);
        }
        return arrayMove(prev, activeIndex, overIndex);
      });
    }

    // Dropping a task over an empty column area
    if (isActiveTask && isOverColumn) {
      setTasks(prev => {
        const activeIndex = prev.findIndex(t => t.id === activeId);
        const newTasks = [...prev];
        newTasks[activeIndex] = { ...newTasks[activeIndex], status: String(overId) };
        return arrayMove(newTasks, activeIndex, activeIndex);
      });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;
    const activeIndex = tasks.findIndex(t => t.id === activeId);
    
    // We already optimistically updated the tasks state during drag over, 
    // but drag end means we finalize the new order in state and persist.
    
    let newTasks = [...tasks];
    if (activeId !== overId) {
      const overIndex = tasks.findIndex(t => t.id === overId);
      if (overIndex !== -1) {
        newTasks = arrayMove(newTasks, activeIndex, overIndex);
      }
    }

    // Re-assign order_index based on visual layout for affected column(s)
    const activeTaskFinal = newTasks.find(t => t.id === activeId);
    if (!activeTaskFinal) return;

    const targetStatus = activeTaskFinal.status;
    
    // Update state to lock in the visual order_index
    const updatedTasks = newTasks.map((t, idx) => ({ ...t, order_index: idx }));
    setTasks(updatedTasks);

    // Filter tasks that need saving (we can just save the whole column for simplicity, 
    // or batch save everything that changed, but saving everything in the same status is safe).
    const columnTasks = updatedTasks.filter(t => t.status === targetStatus);
    const updates = columnTasks.map((t, idx) => ({
      id: t.id,
      status: t.status,
      order_index: idx
    }));

    // Fire off API request to persist order
    fetch('/api/tasks/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates })
    });
  };

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }),
  };

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 h-full flex flex-col">
      <div className="flex items-center gap-3 mb-6">
        <KanbanSquare size={20} className="text-indigo-400" />
        <h2 className="text-base font-bold text-white">Kanban Board</h2>
      </div>

      {loading ? (
        <div className="text-center text-white/50 text-sm py-10">Loading tasks...</div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full overflow-x-auto pb-2">
            {COLUMNS.map(col => {
              const columnTasks = getTasksByStatus(col.id);
              
              return (
                <div 
                  key={col.id} 
                  className="flex flex-col bg-white/[0.02] border border-white/5 rounded-xl min-w-[280px] max-w-[280px] p-3"
                >
                  <div className="flex items-center justify-between mb-4 px-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
                      <h3 className="text-sm font-semibold text-white/80">{col.title}</h3>
                      <span className="text-xs bg-white/10 text-white/60 px-2 py-0.5 rounded-full">
                        {columnTasks.length}
                      </span>
                    </div>
                    <button className="text-white/40 hover:text-white/80 transition-colors">
                      <MoreHorizontal size={16} />
                    </button>
                  </div>
                  
                  <div className="flex-1 flex flex-col min-h-[150px]">
                    <SortableContext 
                      id={col.id} 
                      items={columnTasks.map(t => t.id)} 
                      strategy={verticalListSortingStrategy}
                    >
                      {columnTasks.map(t => (
                        <SortableTask key={t.id} task={t} />
                      ))}
                    </SortableContext>
                  </div>
                </div>
              );
            })}
          </div>
        </DndContext>
      )}
    </div>
  );
}
