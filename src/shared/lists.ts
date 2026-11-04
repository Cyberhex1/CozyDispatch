/** Shareable game lists (shared by the browser and the API). */
import type { Avatar } from './account';
import type { Game } from './content';

export interface GameListSummary {
  /** Random id; the public link is /list/:id */
  id: string;
  title: string;
  description: string;
  /** Ordered as the owner arranged them. */
  appIds: number[];
  createdAt: string;
  updatedAt: string;
}

export interface GameList extends GameListSummary {
  owner: { displayName: string; avatar: Avatar };
  /** True when the signed-in viewer made this list. */
  isOwner: boolean;
  /** Games still in the catalog, in list order. */
  games: Game[];
}
