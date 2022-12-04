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

export function setupLayout(kpConfig: ConfigObject): Promise<any> {
    // return (promise of) a full just-started "katapod environment" object
	vscode.commands.executeCommand('workbench.action.editorLayoutTwoColumns');
    let panel: vscode.WebviewPanel = createPanel();
    const envPromise = new Promise<any>((resolve, reject) => {
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
    });
    return envPromise;
}
