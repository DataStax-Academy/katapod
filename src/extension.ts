const { syncBuiltinESMExports } = require('module');
// import { waitForDebugger } from 'inspector';
import * as vscode from 'vscode';

import {readKatapodConfig, ConfigObject, ConfigTerminal} from './configuration';
import {log} from './logging';
import {runCommand, FullCommand} from './runCommands';
import {loadPage, reloadPage, TargetStep} from './rendering';

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
	vscode.commands.executeCommand('workbench.action.editorLayoutTwoColumns');

	readKatapodConfig().then(
		(cfg: ConfigObject) => {
			kpEnvironment.configuration = cfg;
			kpEnvironment.components.panel = createPanel();
			setTerminalLayout(kpEnvironment.configuration).then(
				terminalMap => {
					kpEnvironment.components.terminalMap = terminalMap;
					kpEnvironment.components.terminals = kpEnvironment.configuration.layout.terminals.map( (term: ConfigTerminal) => terminalMap[term.id] );
					log('debug', '[start] Terminals set.');
					log('debug', `[start] "terminalMap" = ${JSON.stringify(kpEnvironment.components.terminalMap)}`);
					log('debug', `[start] "terminals" = ${JSON.stringify(kpEnvironment.components.terminals)}`);
					loadPage({ 'step': 'intro' }, kpEnvironment);
					log('debug', '[start] Ready to rock.');
				},
				rejected => log('error', rejected)
			);
		},
		rej => log('error', rej)
	);
}

function createPanel() {
	log('debug', '[createPanel] Creating WebView...');
	return vscode.window.createWebviewPanel(
		'datastax.katapod',
		'DataStax Training Grounds',
		vscode.ViewColumn.One,
		{
			enableCommandUris: true,
			enableScripts: true,
			retainContextWhenHidden: true,
			enableFindWidget: true
		}
	);
}


async function setTerminalLayout(config: ConfigObject): Promise<any> {
	// return a Promise of a map string->Terminal for the created objects
	// TODO: write this mess with arbitrary number of nested promises (LOL)

	const configTerminals: Array<ConfigTerminal> = config.layout.terminals;
	const numTerminals: number = configTerminals.length;

	var terminalsP = new Promise<any>((resolve, reject) => {
		if (numTerminals === 1) {
			vscode.commands.executeCommand('workbench.action.editorLayoutTwoColumns').then(
				function () {
					vscode.commands.executeCommand('workbench.action.focusSecondEditorGroup').then(
						function () {
							let t0: vscode.Terminal;

							log('debug', 'T0 ...');
							const locationOptions: vscode.TerminalEditorLocationOptions = {
								viewColumn: vscode.ViewColumn.Two
							};
							const terminalId: string = configTerminals[0].id;
							const terminalName: string = configTerminals[0].name || terminalId;
							const terminalOptions: vscode.TerminalOptions = {
								name: terminalName,
								location: locationOptions
							};
							t0 = vscode.window.createTerminal(terminalOptions);

							resolve({[terminalId]: t0});
						}
					);
				}
			);
		} else if (numTerminals === 2) {
			vscode.commands.executeCommand('workbench.action.editorLayoutTwoColumns').then(
				function () {
					vscode.commands.executeCommand('workbench.action.focusSecondEditorGroup').then(
						function () {
							vscode.commands.executeCommand('workbench.action.splitEditorDown').then(
								function() {

									let t0: vscode.Terminal;
									let t1: vscode.Terminal;

									log('debug', 'T0 ...');
									const locationOptions: vscode.TerminalEditorLocationOptions = {
										viewColumn: vscode.ViewColumn.Two
									};
									const terminalId: string = configTerminals[0].id;
									const terminalName: string = configTerminals[0].name || terminalId;
									const terminalOptions: vscode.TerminalOptions = {
										name: terminalName,
										location: locationOptions
									};
									t0 = vscode.window.createTerminal(terminalOptions);

									//

									log('debug', 'T1 ...');
									const locationOptions1: vscode.TerminalEditorLocationOptions = {
										viewColumn: vscode.ViewColumn.Three
									};

									const terminalId1: string = configTerminals[1].id;
									const terminalName1: string = configTerminals[1].name || terminalId;
									const terminalOptions1: vscode.TerminalOptions = {
										name: terminalName1,
										location: locationOptions1
									};
									t1 = vscode.window.createTerminal(terminalOptions1);

									resolve({
										[terminalId]: t0,
										[terminalId1]: t1
									});

								}
							);
						}
					);
				}
			);
		} else {
			reject(new Error('numTerminals supports only values 1 and 2.'));
		}
	});
	//
	return terminalsP;
}
