export { BoardView } from './components/BoardView';
export { FirstLaunch } from './components/FirstLaunch';
export { Sidebar, type SidebarProps } from './components/Sidebar';
export {
  useArchiveBoard,
  useBoard,
  useBoards,
  useCreateBoard,
  useDuplicateBoard,
  useMoveBoard,
  useMoveColumn,
  useUpdateBoard,
} from './hooks/queries';

/** The Archives page, loaded on demand (secondary view): `ArchivesPage` and `Archives`. */
export const loadArchives = () => import('./components/Archives');
