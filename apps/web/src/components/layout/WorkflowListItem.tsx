import { motion } from 'framer-motion';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { WorkflowListItem as WorkflowListItemType } from '@/api/client';

interface WorkflowListItemProps {
  workflow: WorkflowListItemType;
  isSelected: boolean;
  isEditing: boolean;
  editingName: string;
  onSelect: () => void;
  onDelete: () => void;
  onStartEdit: () => void;
  onEditingNameChange: (v: string) => void;
  onEditingKeyDown: (e: React.KeyboardEvent) => void;
  onEditingBlur: () => void;
}

export function WorkflowListRow({
  workflow,
  isSelected,
  isEditing,
  editingName,
  onSelect,
  onDelete,
  onStartEdit,
  onEditingNameChange,
  onEditingKeyDown,
  onEditingBlur,
}: WorkflowListItemProps) {
  if (isEditing) {
    return (
      <motion.li
        layout
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-1"
      >
        <Input
          value={editingName}
          onChange={(e) => onEditingNameChange(e.target.value)}
          onKeyDown={onEditingKeyDown}
          onBlur={onEditingBlur}
          autoFocus
          className="h-8 flex-1 text-sm"
          onClick={(e) => e.stopPropagation()}
        />
      </motion.li>
    );
  }

  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.15 }}
      className="group flex items-center gap-1 rounded-lg"
    >
      <Button
        type="button"
        variant="ghost"
        className={`min-w-0 flex-1 justify-start truncate rounded-md h-8 font-medium
          ${isSelected ? 'bg-[var(--list-active)] text-[var(--list-active-text)]' : 'hover:bg-[var(--list-hover)]'}`}
        onClick={onSelect}
      >
        {workflow.name}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-lg opacity-50 hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="!w-auto min-w-32 rounded-lg">
          <DropdownMenuItem onClick={onStartEdit} className="gap-2">
            <Pencil className="h-3.5 w-3.5" />
            重命名
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={onDelete} className="gap-2">
            <Trash2 className="h-3.5 w-3.5" />
            删除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </motion.li>
  );
}
