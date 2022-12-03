const { syncBuiltinESMExports } = require('module');
import { waitForDebugger } from 'inspector';
import * as vscode from 'vscode';
const path = require('path');
const fs = require('fs');
const markdownIt = require('markdown-it');
const markdownItAttrs = require('markdown-it-attrs');

import {readKatapodConfig, ConfigObject, ConfigTerminal} from './configuration';
import {getWorkingDir} from './filesystem';
import {log} from './logging';
// import {sendTextToTerminal, sendTextsPerTerminal, runInitScripts} from './runCommands';
import {runCommand, runCommandsPerTerminal, ConfigCommand, FullCommand} from './runCommands';
import {parseCodeBlockContent} from './rendering';


let kpEnvironment: any = {
	components: {
		terminals: null, // vscode.Terminal[],
		terminalMap: null, // any,
		panel: null, // vscode.WebviewPanel,
	},
	configuration: null, // ConfigObject,
	state: {
		currentStep: null, // string,
	}
};

// closing over the kpEnvironment to supply a one-arg command to registerCommand
function sendTextClosure(fullCommand: FullCommand) {
	runCommand(fullCommand, kpEnvironment);
}

export async function activate(context: vscode.ExtensionContext) {
	/*
	Nothing seems to prevent this function from being async
	(which helps fighting nondeterminism in these calls while avoiding chains of ".then(...)" with all await's).
	See https://stackoverflow.com/questions/64640967/can-a-vscode-extension-activate-method-be-async.
	*/
	context.subscriptions.push(vscode.commands.registerCommand('katapod.sendText', sendTextClosure));
	context.subscriptions.push(vscode.commands.registerCommand('katapod.loadPage', loadPage));
	context.subscriptions.push(vscode.commands.registerCommand('katapod.reloadPage', reloadPage));
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


function start (command?: any) {
	vscode.commands.executeCommand('workbench.action.editorLayoutTwoColumns');

	readKatapodConfig().then(
		(cfg: ConfigObject) => {
			kpEnvironment.configuration = cfg;
			log('debug', `[start] KP config : ${JSON.stringify(kpEnvironment.configuration)}`);

			kpEnvironment.components.panel = createPanel();

			setTerminalLayout(kpEnvironment.configuration).then(
				terminalMap => {
					kpEnvironment.components.terminalMap = terminalMap;
					kpEnvironment.components.terminals = kpEnvironment.configuration.layout.terminals.map( (term: ConfigTerminal) => terminalMap[term.id] );
					log('debug', '[start] Terminals set.');
					log('debug', `[start] "terminalMap" = ${JSON.stringify(kpEnvironment.components.terminalMap)}`);
					log('debug', `[start] "terminals" = ${JSON.stringify(kpEnvironment.components.terminals)}`);
					// runInitScripts(kpEnvironment);
					loadPage({ 'step': 'intro' });
					//
					log('debug', '[start] Ready to rock.');
					//
				},
				rejected => log('error', rejected)
			);
		},
		rej => log('error', rej)
	);
}



function createPanel () {
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
		if (numTerminals === 1){
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

	return terminalsP;
}

interface Target {
	step: string;
}

function reloadPage(command: any) {
	loadPage({ 'step': kpEnvironment.state.currentStep });
}

function loadPage (target: Target) {
	kpEnvironment.state.currentStep = target.step;

	const file = vscode.Uri.file(path.join(getWorkingDir(), target.step + '.md'));

	const md = new markdownIt({html: true})
		.use(require('markdown-it-textual-uml'))
		.use(markdownItAttrs);

	// process codeblocks
	md.renderer.rules.fence_default = md.renderer.rules.fence;
	md.renderer.rules.fence = function (tokens: any, idx: any, options: any, env: any, slf: any) {
		var token = tokens[idx],
			info = token.info ? md.utils.unescapeAll(token.info).trim() : '';

		if (info) { // Fallback to the default processor
			return md.renderer.rules.fence_default(tokens, idx, options, env, slf);
		}

		const parsedCommand: FullCommand = parseCodeBlockContent(tokens[idx].content);

		if(parsedCommand.execute !== false){
			return  '<pre' + slf.renderAttrs(token) + ' title="Click <play button> to execute!"><code>' + '<a class="command_link" title="Click to execute!" class="button1" href="command:katapod.sendText?' + 
				renderCommandUri(parsedCommand) + '">▶</a>' + 
				md.utils.escapeHtml(parsedCommand.command) +
			'</code></pre>\n';
		}else{
			return  '<pre><code>' + 
				md.utils.escapeHtml(parsedCommand.command) +
				'</code></pre>\n';
		}

	};

	// process links
	let linkOpenDefault = md.renderer.rules.link_open || function(tokens: any, idx: any, options: any, env: any, self: any) { return self.renderToken(tokens, idx, options); };
	md.renderer.rules.link_open = function (tokens: any, idx: any, options: any, env: any, self: any) {
		var href = tokens[idx].attrIndex('href');
	  
		let url = tokens[idx].attrs[href][1];
		if (url.includes('command:katapod.loadPage?')) {
			let uri = url.replace('command:katapod.loadPage?', '');
			tokens[idx].attrs[href][1] = 'command:katapod.loadPage?' + renderStepUri(uri);
		}
	  
		return linkOpenDefault(tokens, idx, options, env, self);
	};

	const pre = `<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<link rel="stylesheet" type="text/css" href="https://datastax-academy.github.io/katapod-shared-assets/css/katapod.css" />
		<script src="https://datastax-academy.github.io/katapod-shared-assets/js/katapod.js"></script>
		<link rel="stylesheet" type="text/css" href="https://datastax-academy.github.io/katapod-shared-assets/quiz/quiz.css" />
		<link rel="stylesheet" type="text/css" href="https://datastax-academy.github.io/katapod-shared-assets/quiz/page.css" />
		<script src="https://datastax-academy.github.io/katapod-shared-assets/quiz/quiz.js"></script>
		<script src="https://datastax-academy.github.io/katapod-shared-assets/quiz/main.js"></script>
	</head>
	<body>`;
	const post = `</body></html>`;
	var result = md.render((fs.readFileSync(file.fsPath, 'utf8')));

	kpEnvironment.components.panel.webview.html = pre + result + post;

	// process step-scripts if any
	const stepScripts = (kpEnvironment.configuration.navigation?.onLoadCommands || {})[target.step] || {} as {[terminalId: string]: ConfigCommand};
	runCommandsPerTerminal(stepScripts, kpEnvironment, `onLoad[${target.step}]`);

	vscode.commands.executeCommand('notifications.clearAll');
}

function renderStepUri (step: string): string {
	const uri = encodeURIComponent(JSON.stringify([{ 'step': step }])).toString();
	return uri;
}

function renderCommandUri (fullCommand: FullCommand): string {
	const uri = encodeURIComponent(JSON.stringify([fullCommand])).toString();
	return uri;
}
