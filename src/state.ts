/*
Handling and definitions pertaining to "state" of the scenario during its lifetime.
*/

import * as vscode from 'vscode';

import {ConfigObject} from './configuration';


export type TerminalMap = {[terminalId: string]: vscode.Terminal};

export interface KatapodEnvironment {
    components: {
		terminals: Array<vscode.Terminal>;
		terminalMap: TerminalMap;
		panel: vscode.WebviewPanel;
    },
	configuration: ConfigObject;
	state: {
		currentStep: string | typeof NoStepYet;
	}
}

export const NoStepYet = Symbol("uninitialized");
