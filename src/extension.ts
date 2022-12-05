const { syncBuiltinESMExports } = require('module');
// import { waitForDebugger } from 'inspector';
import * as vscode from 'vscode';

import {readKatapodConfig, ConfigObject, ConfigTerminal} from './configuration';
import {log} from './logging';
import {runCommand, FullCommand} from './runCommands';
import {loadPage, reloadPage, TargetStep} from './rendering';
import {setupLayout} from './layout';

let kpEnvironment: any = {
	components: {
		terminals: null, // Array<vscode.Terminal>
		terminalMap: null, // {[terminalId: string]: vscode.Terminal}
		panel: null, // vscode.WebviewPanel
	},
	configuration: null, // ConfigObject
	state: {
		currentStep: null, // string
	}
};

// closing over the kpEnvironment to supply one-arg functions to registerCommand
function sendTextClosure(fullCommand: FullCommand) {
	runCommand(fullCommand, kpEnvironment);
}
function loadPageClosure(target: TargetStep) {
	loadPage(target, kpEnvironment);
}
function reloadPageClosure(command: any) {
	reloadPage(command, kpEnvironment);
}

export async function activate(context: vscode.ExtensionContext) {
	/*
	Nothing seems to prevent this function from being async
	(which helps fighting nondeterminism in these calls while avoiding chains of ".then(...)" with all await's).
	See https://stackoverflow.com/questions/64640967/can-a-vscode-extension-activate-method-be-async.
	*/
	context.subscriptions.push(vscode.commands.registerCommand('katapod.sendText', sendTextClosure));
	context.subscriptions.push(vscode.commands.registerCommand('katapod.reloadPage', reloadPageClosure));
	context.subscriptions.push(vscode.commands.registerCommand('katapod.loadPage', loadPageClosure));
	context.subscriptions.push(vscode.commands.registerCommand('katapod.start', start));

	await vscode.commands.executeCommand('notifications.clearAll');
	await vscode.commands.executeCommand('workbench.action.closeSidebar');
	await vscode.commands.executeCommand('workbench.action.closeAuxiliaryBar');
	await vscode.commands.executeCommand('workbench.action.closePanel');
	await vscode.commands.executeCommand('workbench.action.closeAllEditors');
	start();
	await vscode.commands.executeCommand('notifications.clearAll');
}

export function deactivate() {}

function start(command?: any) {
	readKatapodConfig().then(
		(kpConfig: ConfigObject) => {
			setupLayout(kpConfig).then(
				fullEnvironment => {
					kpEnvironment = fullEnvironment;
					// log('debug', `Full Environment:\n${JSON.stringify(kpEnvironment, null, 2)}`);
					log('debug', `TerminalMap = ${JSON.stringify(kpEnvironment.components.terminalMap)}`);
					loadPage({'step': 'intro'}, kpEnvironment);
				},
				rej => log('error', `Error setting up layout ${rej}`)
			);
		},
		rej => log('error', `Error reading config ${rej}`)
	);
}
