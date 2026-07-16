export type TreeNode = {
  type: "file" | "folder";
  name: string;
  path: string;
  children?: TreeNode[];
};

export type SaveStatus = "saved" | "dirty" | "saving" | "error";

export type Tab = {
  path: string;
  name: string;
  status: SaveStatus;
  errorMessage?: string;
};

export type ElectronAPI = {
  getTree: () => Promise<TreeNode[]>;
  readFile: (rel: string) => Promise<string>;
  writeFile: (rel: string, content: string) => Promise<void>;
  createFile: (dirRel: string) => Promise<string>;
  createFolder: (dirRel: string) => Promise<string>;
  renameEntry: (rel: string, newName: string) => Promise<string>;
  moveEntry: (srcRel: string, destDirRel: string) => Promise<string>;
  deleteEntry: (rel: string) => Promise<void>;
  duplicateFile: (rel: string) => Promise<string>;
  onFsChanged: (callback: () => void) => () => void;
  libraryGet: () => Promise<string | null>;
  librarySave: (json: string) => Promise<void>;
  onLibraryAdd: (callback: (json: string) => void) => () => void;
  onLibraryAddError: (callback: (message: string) => void) => () => void;
  windowMinimize: () => void;
  windowToggleMaximize: () => void;
  windowClose: () => void;
};

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
