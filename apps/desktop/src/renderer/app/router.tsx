import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Navigate,
  Outlet,
  useNavigate,
  useParams,
} from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BoardView,
  FirstLaunch,
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
  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar
        boards={boards}
        activeBoardId={params.boardId}
        collapsed={collapsed}
        onToggle={() => setCollapsed((value) => !value)}
        onSelectBoard={(boardId) => void navigate({ to: '/boards/$boardId', params: { boardId } })}
      />
      <Outlet />
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

export const router = createRouter({
  routeTree: rootRoute.addChildren([homeRoute, boardRoute]),
  history: createMemoryHistory({ initialEntries: ['/'] }),
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
