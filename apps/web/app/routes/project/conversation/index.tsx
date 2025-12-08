import { useWorkspace } from '~/lib/context/workspace-context';
import { useParams, useNavigate } from 'react-router';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { useConversation } from '~/lib/mutations/use-conversation';
import { useGetProjectBySlug } from '~/lib/queries/use-get-projects';
import { useGetConversationsByProject } from '~/lib/queries/use-get-conversations-by-project';
import { createPath } from '~/config/paths.config';
import pathsConfig from '~/config/paths.config';
import { Conversation } from '@qwery/domain/entities';
import {
  MessageCircle,
  ClockIcon,
  Sparkles,
  ArrowRight,
  Plus,
} from 'lucide-react';
import { cn } from '@qwery/ui/utils';
import { Button } from '@qwery/ui/button';

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (diffDays === 0) {
    return `Today at ${timeStr}`;
  }
  if (diffDays === 1) {
    return `Yesterday at ${timeStr}`;
  }

  const day = date.getDate();
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const year = date.getFullYear();
  return `${day} ${month} ${year} at ${timeStr}`;
}

export default function ConversationIndexPage() {
  const { workspace, repositories } = useWorkspace();
  const navigate = useNavigate();
  const projectSlug = useParams().slug;

  const project = useGetProjectBySlug(repositories.project, projectSlug || '');
  const { data: allConversations = [], isLoading } =
    useGetConversationsByProject(
      repositories.conversation,
      workspace.projectId,
    );

  const recentConversations = allConversations
    .sort((a, b) => {
      const dateA =
        a.updatedAt instanceof Date ? a.updatedAt : new Date(a.updatedAt);
      const dateB =
        b.updatedAt instanceof Date ? b.updatedAt : new Date(b.updatedAt);
      return dateB.getTime() - dateA.getTime();
    })
    .slice(0, 5);

  const createConversationMutation = useConversation(
    repositories.conversation,
    (conversation) => {
      navigate(createPath(pathsConfig.app.conversation, conversation.slug));
    },
    (error) => {
      toast.error(
        `Failed to create conversation: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    },
    workspace.projectId,
  );

  const handleConversationClick = (conversation: Conversation) => {
    navigate(createPath(pathsConfig.app.conversation, conversation.slug));
  };

  const handleNewChat = () => {
    if (!project.data) {
      toast.error('Project not found');
      return;
    }

    if (!repositories.conversation) {
      toast.error('Conversation repository not available');
      return;
    }

    if (!workspace.userId) {
      toast.error('User not authenticated');
      return;
    }

    createConversationMutation.mutate({
      projectId: project.data.id,
      taskId: uuidv4(), // TODO: Create or get actual task
      title: 'New Conversation',
      seedMessage: '',
      datasources: [],
      createdBy: workspace.userId,
    });
  };

  return (
    <div className="flex min-h-[calc(100vh-8rem)] w-full flex-col items-center justify-center px-4 py-12">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        {/* Welcome Header */}
        <div className="space-y-4 text-center">
          <div className="flex justify-center">
            <div className="bg-primary/10 flex size-16 items-center justify-center rounded-full">
              <Sparkles className="text-primary size-8" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">
              Start a new conversation
            </h1>
            <p className="text-muted-foreground text-lg">
              Ask anything or describe what you'd like to explore
            </p>
          </div>
        </div>

        {/* Recent Conversations List */}
        {recentConversations.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2">
              <ClockIcon className="text-muted-foreground size-4" />
              <h2 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
                Recent Conversations
              </h2>
            </div>
            <div className="mx-auto w-full max-w-2xl space-y-2">
              {recentConversations.map((conversation) => {
                const updatedAt =
                  conversation.updatedAt instanceof Date
                    ? conversation.updatedAt
                    : new Date(conversation.updatedAt);
                const timeLabel = formatRelativeTime(updatedAt);

                return (
                  <button
                    key={conversation.id}
                    onClick={() => handleConversationClick(conversation)}
                    className={cn(
                      'group bg-card flex w-full items-center gap-4 rounded-lg border px-5 py-4 text-left transition-all',
                      'hover:border-primary/20 hover:bg-accent/50 hover:shadow-sm',
                      'focus-visible:ring-primary/20 focus-visible:ring-2 focus-visible:outline-none',
                    )}
                  >
                    <div className="bg-muted group-hover:bg-primary/10 group-hover:text-primary flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors">
                      <MessageCircle className="size-5" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="truncate text-sm font-semibold">
                        {conversation.title}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {timeLabel}
                      </span>
                    </div>
                    <ArrowRight className="text-muted-foreground size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-center">
            <div className="flex justify-center">
              <div className="bg-muted flex size-12 items-center justify-center rounded-lg">
                <MessageCircle className="text-muted-foreground size-6" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-muted-foreground text-sm font-medium">
                No conversations yet
              </p>
              <p className="text-muted-foreground text-xs">
                Start a new conversation to get started
              </p>
            </div>
          </div>
        )}

        {/* New Chat Button */}
        <div className="flex justify-center">
          <Button
            onClick={handleNewChat}
            size="lg"
            variant="outline"
            className="gap-2"
            disabled={createConversationMutation.isPending}
          >
            <Plus className="size-4" />
            Start a new conversation
          </Button>
        </div>
      </div>
    </div>
  );
}
