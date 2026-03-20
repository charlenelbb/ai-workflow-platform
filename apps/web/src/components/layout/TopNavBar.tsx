/**
 * 顶部导航栏：Logo、工作流名称、画布操作按钮组、用户区
 * 固定于顶部，8px 圆角与轻微阴影，适配响应式
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Play,
  Save,
  Download,
  Share2,
  Rocket,
  Link2,
  Maximize2,
  AlignCenter,
  Undo2,
  Redo2,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const LOGO_TEXT = 'Workflow';

interface TopNavBarProps {
  /** 当前工作流名称，可编辑 */
  workflowName: string;
  onWorkflowNameChange?: (name: string) => void;
  onSave?: () => void;
  onRun?: () => void;
  /** 发布当前工作流（服务器已保存版本） */
  onPublish?: () => void;
  publishing?: boolean;
  /** 当前工作流已发布时的对外 appId，用于打开「发布信息」 */
  publishedAppId?: string | null;
  onOpenPublishSheet?: () => void;
  saving?: boolean;
  running?: boolean;
  /** 是否有选中的工作流（用于禁用保存/运行） */
  hasWorkflow?: boolean;
  className?: string;
}

export function TopNavBar({
  workflowName,
  onWorkflowNameChange,
  onSave,
  onRun,
  onPublish,
  publishing = false,
  publishedAppId = null,
  onOpenPublishSheet,
  saving = false,
  running = false,
  hasWorkflow = false,
  className,
}: TopNavBarProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(workflowName);
  useEffect(() => {
    if (!isEditingName) setEditName(workflowName);
  }, [workflowName, isEditingName]);

  const handleNameBlur = () => {
    setIsEditingName(false);
    const trimmed = editName.trim();
    if (trimmed && trimmed !== workflowName && onWorkflowNameChange) {
      onWorkflowNameChange(trimmed);
    } else {
      setEditName(workflowName);
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
    if (e.key === 'Escape') {
      setEditName(workflowName);
      setIsEditingName(false);
      (e.target as HTMLInputElement).blur();
    }
  };

  const actionBtnClass =
    'h-8 gap-1.5 rounded-lg border-border bg-card text-foreground hover:bg-[var(--muted)] transition-colors shadow-sm';

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-4 shadow-sm',
        className,
      )}
    >
      {/* 左侧：Logo + 工作流名称 */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary)] text-sm font-semibold text-white">
            {LOGO_TEXT.slice(0, 1)}
          </div>
          <span className="hidden text-sm font-semibold text-muted-foreground sm:inline">
            {LOGO_TEXT}
          </span>
        </div>
        <div className="h-5 w-px shrink-0 bg-border" />
        {isEditingName ? (
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={handleNameKeyDown}
            className="h-8 max-w-[240px] text-base font-semibold"
            autoFocus
          />
        ) : (
          <button
            type="button"
            onClick={() => hasWorkflow && setIsEditingName(true)}
            className="truncate text-left text-lg font-semibold text-foreground hover:text-[var(--primary)] transition-colors outline-none min-w-0 max-w-[280px]"
          >
            {workflowName || '未命名工作流'}
          </button>
        )}
      </div>

      {/* 中间：画布操作按钮组 */}
      <div className="flex shrink-0 items-center gap-1">
        {onRun && (
          <Button
            type="button"
            size="sm"
            className={cn(actionBtnClass, 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]')}
            onClick={onRun}
            disabled={!hasWorkflow || running}
          >
            <Play className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{running ? '运行中…' : '运行'}</span>
          </Button>
        )}
        {onSave && (
          <Button
            type="button"
            size="sm"
            className={actionBtnClass}
            onClick={onSave}
            disabled={!hasWorkflow || saving}
          >
            <Save className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{saving ? '保存中…' : '保存'}</span>
          </Button>
        )}
        {onPublish && (
          <Button
            type="button"
            size="sm"
            className={cn(
              actionBtnClass,
              'border-[var(--primary)]/40 bg-[var(--accent)]/80 text-[var(--primary)] hover:bg-[var(--accent)]',
            )}
            onClick={onPublish}
            disabled={!hasWorkflow || publishing || saving}
            title="将当前已保存到服务器的工作流发布为 App"
          >
            <Rocket className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{publishing ? '发布中…' : '发布'}</span>
          </Button>
        )}
        {publishedAppId && onOpenPublishSheet && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={actionBtnClass}
            onClick={onOpenPublishSheet}
            title="查看嵌入链接与 API"
          >
            <Link2 className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">发布信息</span>
          </Button>
        )}
        <Button type="button" size="sm" variant="outline" className={actionBtnClass} disabled={!hasWorkflow} title="导出（待实现）">
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">导出</span>
        </Button>
        <Button type="button" size="sm" variant="outline" className={actionBtnClass} disabled={!hasWorkflow} title="分享（待实现）">
          <Share2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">分享</span>
        </Button>
        <Button type="button" size="sm" variant="outline" className={actionBtnClass} disabled={!hasWorkflow} title="全屏（待实现）">
          <Maximize2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">全屏</span>
        </Button>
        <Button type="button" size="sm" variant="outline" className={actionBtnClass} disabled={!hasWorkflow} title="对齐（待实现）">
          <AlignCenter className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">对齐</span>
        </Button>
        <Button type="button" size="sm" variant="outline" className={actionBtnClass} disabled={!hasWorkflow} title="撤销（待实现）">
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="sm" variant="outline" className={actionBtnClass} disabled={!hasWorkflow} title="重做（待实现）">
          <Redo2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* 右侧：用户头像 / 设置 */}
      <div className="flex shrink-0 items-center">
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full border border-border bg-muted/50 hover:bg-muted"
            >
              <User className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[140px]">
            <DropdownMenuItem>设置</DropdownMenuItem>
            <DropdownMenuItem>退出</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.header>
  );
}
