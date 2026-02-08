import { CodeEditorFsEvent, CodeEditorOpenFileRequest, CodeEditorPersistedState } from "../../components/CodeEditorPanel";
import { FileExplorerPersistedState } from "../../components/FileExplorerPanel";

export type WorkspaceView = {
  projectId: string;
  fileExplorerOpen: boolean;
  fileExplorerRootDir: string | null;
  fileExplorerPersistedState: FileExplorerPersistedState | null;
  codeEditorOpen: boolean;
  codeEditorRootDir: string | null;
  openFileRequest: CodeEditorOpenFileRequest | null;
  codeEditorActiveFilePath: string | null;
  codeEditorPersistedState: CodeEditorPersistedState | null;
  codeEditorFsEvent: CodeEditorFsEvent | null;
  editorWidth: number;
  treeWidth: number;
};
