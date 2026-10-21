import { create } from 'zustand';

/**
 * Layout state shared by the sidebar, the app layout and the command palette (its "Réduire la barre
 * latérale" and "Nouveau board" actions, the ⌘\ shortcut), so none of them imports another feature.
 * Ephemeral: the sidebar opens at every start (approved board mockup: open by default).
 */
interface LayoutState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  /** Bumped to ask the sidebar to open its "Nouveau board" popover under "+". */
  newBoardRequest: number;
  requestNewBoard: () => void;
}

export const useLayout = create<LayoutState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  newBoardRequest: 0,
  requestNewBoard: () => set((state) => ({ newBoardRequest: state.newBoardRequest + 1 })),
}));
