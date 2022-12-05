/*
Creating and managing VSCode layout.
*/

import * as vscode from 'vscode';

import {log} from './logging';
import {ConfigObject, ConfigTerminal} from './configuration';


function createPanel(): vscode.WebviewPanel {
	log('debug', '[createPanel] Creating WebViewPanel...');
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
	const terminalViewColumns = [
		vscode.ViewColumn.Two,
		vscode.ViewColumn.Three,
		vscode.ViewColumn.Four,
		vscode.ViewColumn.Five,
		vscode.ViewColumn.Six,
		vscode.ViewColumn.Seven,
		vscode.ViewColumn.Eight,
		vscode.ViewColumn.Nine,
	];
	const configTerminals: Array<ConfigTerminal> = config.layout.terminals;
	const numTerminals: number = configTerminals.length;
	var terminalsP = new Promise<any>(async function (resolve, reject) {
		if (numTerminals <= terminalViewColumns.length) {
			// vscode.commands.executeCommand('workbench.action.editorLayoutTwoColumns').then(
			// 	async function () {
					let terminalMap: {[id: string]: vscode.Terminal} = {};
					for(let i: number = 0; i < numTerminals; i++){
						// https://github.com/microsoft/vscode/issues/107873 LOL
						await vscode.commands.executeCommand('workbench.action.focusRightGroupWithoutWrap');
						if (i < numTerminals - 1){
							await vscode.commands.executeCommand('workbench.action.splitEditorDown');
						}
						const termPosition = terminalViewColumns[i];
						const configTerminal = configTerminals[i];
						log('debug', `[setTerminalLayout] Creating ${configTerminal.id}/"${configTerminal.name}" (${i+1}/${numTerminals})`);
						const locationOptions: vscode.TerminalEditorLocationOptions = {
							viewColumn: termPosition,
						};
						const terminalId: string = configTerminal.id;
						const terminalName: string = configTerminal.name || terminalId;
						const terminalOptions: vscode.TerminalOptions = {
							name: terminalName,
							location: locationOptions
						};
						terminalMap[configTerminal.id] = vscode.window.createTerminal(terminalOptions);
					}

					// await vscode.commands.executeCommand('workbench.action.closeActiveEditor');


					resolve(terminalMap);
			// 	}
			// );
		} else {
			reject(new Error('Too many terminals.'));
		}
	});
	//
	return terminalsP;
}

export function setupLayout(kpConfig: ConfigObject): Promise<any> {
    // return (promise of) a full just-started "katapod environment" object
    let panel: vscode.WebviewPanel = createPanel();
    const envPromise = new Promise<any>((resolve, reject) => {
		vscode.commands.executeCommand('workbench.action.editorLayoutTwoColumns').then(
			async function () {
				setTerminalLayout(kpConfig).then(
					terminalMap => {
						// build full environment
						const environment: any = {
							components: {
								terminals: kpConfig.layout.terminals.map( (term: ConfigTerminal) => terminalMap[term.id] ),
								terminalMap: terminalMap,
								panel: panel,
							},
							configuration: kpConfig,
							state: {
								currentStep: null,
							}
						};
						resolve(environment);
					},
					rej => reject(rej)
				);
			}
		);
    });
    return envPromise;
}
