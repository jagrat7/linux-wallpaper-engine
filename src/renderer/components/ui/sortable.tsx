'use client'

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  restrictToHorizontalAxis,
  restrictToParentElement,
  restrictToVerticalAxis,
} from '@dnd-kit/modifiers'
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import * as React from 'react'

import { cn } from '@/lib/utils'

// A list whose items drag into a new order. Built on dnd-kit, the way shadcn's own blocks do
// drag. An item moves by its SortableHandle: with a pointer, or from the keyboard (space to
// pick up, arrow keys to move, space to drop).

function Sortable({
  value,
  onValueChange,
  orientation = 'vertical',
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  /** The items' ids, in order. Each SortableItem's `value` is one of them. */
  value: string[]
  onValueChange: (value: string[]) => void
  orientation?: 'vertical' | 'horizontal'
}) {
  // Fixed ids, so the server and the browser agree on dnd-kit's ARIA attributes.
  const id = React.useId()
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const vertical = orientation === 'vertical'

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const from = value.indexOf(String(active.id))
    const to = value.indexOf(String(over.id))
    if (from >= 0 && to >= 0) onValueChange(arrayMove(value, from, to))
  }

  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[
        vertical ? restrictToVerticalAxis : restrictToHorizontalAxis,
        restrictToParentElement,
      ]}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={value}
        strategy={vertical ? verticalListSortingStrategy : horizontalListSortingStrategy}
      >
        <div
          data-slot="sortable"
          data-orientation={orientation}
          className={cn('flex data-[orientation=vertical]:flex-col', className)}
          {...props}
        >
          {children}
        </div>
      </SortableContext>
    </DndContext>
  )
}

type Handle = Pick<
  ReturnType<typeof useSortable>,
  'attributes' | 'listeners' | 'setActivatorNodeRef'
>

const SortableItemContext = React.createContext<Handle | null>(null)

function SortableItem({
  value,
  className,
  style,
  ...props
}: React.ComponentProps<'div'> & { value: string }) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: value })
  const handle = React.useMemo(
    () => ({ attributes, listeners, setActivatorNodeRef }),
    [attributes, listeners, setActivatorNodeRef],
  )

  return (
    <SortableItemContext value={handle}>
      <div
        ref={setNodeRef}
        data-slot="sortable-item"
        data-dragging={isDragging || undefined}
        className={cn('relative data-dragging:z-10 data-dragging:opacity-70', className)}
        style={{ transform: CSS.Translate.toString(transform), transition, ...style }}
        {...props}
      />
    </SortableItemContext>
  )
}

function SortableHandle({ className, children, ...props }: React.ComponentProps<'button'>) {
  const handle = React.use(SortableItemContext)
  if (!handle) throw new Error('SortableHandle must be inside a SortableItem')

  return (
    <button
      type="button"
      ref={handle.setActivatorNodeRef}
      data-slot="sortable-handle"
      className={cn(
        "text-muted-foreground hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-sm border border-transparent transition-colors outline-none focus-visible:ring-1 active:cursor-grabbing [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-3.5",
        className,
      )}
      {...handle.attributes}
      {...handle.listeners}
      {...props}
    >
      {children ?? (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="9" cy="5" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="9" cy="19" r="1.5" />
          <circle cx="15" cy="5" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="15" cy="19" r="1.5" />
        </svg>
      )}
    </button>
  )
}

export { Sortable, SortableItem, SortableHandle }
