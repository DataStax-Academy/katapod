/*
Filesystem and I/O facilities.
*/

import * as vscode from 'vscode';


export function getWorkingDir(): string | undefined {
	if (vscode.workspace.workspaceFolders) {
		return vscode.workspace.workspaceFolders[0].uri.path;
	}

	return vscode.workspace.rootPath;
}