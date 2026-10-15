import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Navigate,
  Outlet,
  useMatchRoute,
  useNavigate,
  useParams,
} from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainArea } from '@renderer/shared/ui/keyboard-help';
import { Feedback } from '@renderer/shared/ui/toast';
import {
  BoardView,
  FirstLaunch,
  loadArchives,
  Sidebar,
  useBoard,
  useBoards,
  useCreateBoard,
} from '@renderer/features/boards';

function Layout() {
  const { data: boards = [] } = useBoards();
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const matchRoute = useMatchRoute();
  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar
        boards={boards}
        activeBoardId={params.boardId}
        collapsed={collapsed}
        onToggle={() => setCollapsed((value) => !value)}
        onSelectBoard={(boardId) => void navigate({ to: '/boards/$boardId', params: { boardId } })}
        archivesActive={Boolean(matchRoute({ to: '/archives' }))}
        onOpenArchives={() => void navigate({ to: '/archives' })}
        onNoBoardLeft={() => void navigate({ to: '/' })}
      />
      <MainArea>
        <Outlet />
      </MainArea>
      <Feedback />
    </div>
  );
}

function Home() {
  const { t } = useTranslation();
  const { data: boards, isPending } = useBoards();
  const createBoard = useCreateBoard();
  const navigate = useNavigate();

  if (isPending) return null;
  const first = boards?.[0];
  if (first) return <Navigate to="/boards/$boardId" params={{ boardId: first.id }} />;

  return (
    <FirstLaunch
      creating={createBoard.isPending}
      onCreateEmpty={() =>
        createBoard.mutate(
          {
            name: t('board.defaultName'),
            columnNames: [t('column.todo'), t('column.inProgress'), t('column.done')],
          },
          { onSuccess: (board) => void navigate({ to: '/boards/$boardId', params: { boardId: board.id } }) },
        )
      }
    />
  );
}

function BoardPage() {
  const { t } = useTranslation();
  const { boardId } = boardRoute.useParams();
  const { data: board, isError } = useBoard(boardId);
  if (isError) return <p className="m-auto text-text-3">{t('board.loadError')}</p>;
  if (!board) return null;
  return <BoardView board={board} />;
}

const rootRoute = createRootRoute({ component: Layout });
const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Home });
const boardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/boards/$boardId',
  component: BoardPage,
});
const archivesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/archives',
  // Secondary view: loaded on first visit (performance rule "lazy-load secondary views").
  component: lazyRouteComponent(loadArchives, 'ArchivesPage'),
});

export const router = createRouter({
  routeTree: rootRoute.addChildren([homeRoute, boardRoute, archivesRoute]),
  history: createMemoryHistory({ initialEntries: ['/'] }),
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
