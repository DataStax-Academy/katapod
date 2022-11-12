const { syncBuiltinESMExports } = require('module');
import { waitForDebugger } from 'inspector';
import * as vscode from 'vscode';
const path = require('path');
const fs = require('fs');
const markdownIt = require('markdown-it');
const markdownItAttrs = require('markdown-it-attrs');

let terminals: vscode.Terminal[];
let terminalMap: any;
let kpConfig: any;
let panel: vscode.WebviewPanel;
let lastStep: string;

export function activate(context: vscode.ExtensionContext) {
	vscode.commands.executeCommand('notifications.clearAll');
	vscode.commands.executeCommand('workbench.action.closeSidebar');
	vscode.commands.executeCommand('workbench.action.closeAuxiliaryBar');
	vscode.commands.executeCommand('workbench.action.closePanel');
	vscode.commands.executeCommand('workbench.action.closeAllEditors').then(start);

	context.subscriptions.push(vscode.commands.registerCommand('katapod.sendText', sendText));
	context.subscriptions.push(vscode.commands.registerCommand('katapod.loadPage', loadPage));
	context.subscriptions.push(vscode.commands.registerCommand('katapod.reloadPage', reloadPage));
	context.subscriptions.push(vscode.commands.registerCommand('katapod.start', start));

	vscode.commands.executeCommand('notifications.clearAll');
}

function start (command?: any) {
	vscode.commands.executeCommand('workbench.action.editorLayoutTwoColumns');

	readKatapodConfig().then(
		cfg => {
			kpConfig = cfg;
			log('debug', `KP config : ${JSON.stringify(kpConfig)}`);

			panel = createPanel();
			log('debug', panel.viewType);
			loadPage({ 'step': 'intro' });

			setTerminalLayout(kpConfig).then(
				tm => {
					terminalMap = tm;
					terminals = kpConfig.terminalTags.map( (tt: string) => tm[tt] );
					log('debug', 'terminals set.');
					log('debug', `terminalMap ${JSON.stringify(terminalMap)}`);
					log('debug', `terminals ${JSON.stringify(terminals)}`);
					wait();
					log('debug', 'ready to rock.');
				},
				rejected => log('error', rejected)
			);
		},
		rej => log('error', rej)
	);
}

function readKatapodConfig(): Promise<any> {
	// return a complete config object, either from file or with defaults

	const cfgP = new Promise<any>((resolve) => {
		const defaultKpConfig = {
			numTerminals: 1,
			terminalNames: ["cqlsh"],
			terminalTags: ["cqlsh-editor"]
		};

		let kpConfig;

		//
		const kpConfigFile = vscode.Uri.file(path.join(getWorkingDir(), '.katapod_config.json'));
		vscode.workspace.fs.stat(kpConfigFile).then(
			function(){
				log('debug', 'Reading KP config file');
				//
				let cfgFromFile;
				try {
					cfgFromFile = JSON.parse(fs.readFileSync(kpConfigFile.path, 'utf8'));
				} catch {
					log('error', 'Unparseable katapod config file');
					cfgFromFile = {};
				}
				//
				kpConfig = {
					// defaults
					...defaultKpConfig,
					// + overrides
					...cfgFromFile
				};
				resolve(kpConfig);
			},
			function () {
				log('debug', 'KP config file not found');
				// defaults only
				kpConfig = defaultKpConfig;
				resolve(kpConfig);
			}
		);
	});

	return cfgP;
}

function wait () {
	const waitsh = vscode.Uri.file(path.join(getWorkingDir(), 'wait.sh'));
	vscode.workspace.fs.stat(waitsh).then(
		function(){
			log('debug', 'Executing wait.sh...');
			terminals[0].sendText('clear; ./wait.sh');
		}, 
		function () {log('debug', 'Skipping wait, wait.sh not found.');}
	);
}

function createPanel () {
	log('debug', 'Creating WebView...');
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

function setTerminalLayout(config: any): Promise<any> {
	// return a Promise of a map string->Terminal for the created objects
	// TODO: write this mess with arbitrary number of nested promises (LOL)

	const numTerminals: number = config.numTerminals;

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
							const termName: string = config.terminalNames[0] || `terminal-${0 + 1}`;
							const termTag: string = config.terminalTags[0] || `term${0 + 1}`;
							const options: vscode.TerminalOptions = {
								name: termName,
								location: locationOptions
							};
							t0 = vscode.window.createTerminal(options);

							resolve({[termTag]: t0});
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
									const termName: string = config.terminalNames[0] || `terminal-${0 + 1}`;
									const termTag: string = config.terminalTags[0] || `term${0 + 1}`;
									const options: vscode.TerminalOptions = {
										name: termName,
										location: locationOptions
									};
									t0 = vscode.window.createTerminal(options);

									//

									log('debug', 'T1 ...');
									const locationOptions1: vscode.TerminalEditorLocationOptions = {
										viewColumn: vscode.ViewColumn.Three
									};
									const termName1: string = config.terminalNames[1] || `terminal-${1 + 1}`;
									const termTag1: string = config.terminalTags[1] || `term${0 + 1}`;
									const options1: vscode.TerminalOptions = {
										name: termName1,
										location: locationOptions1
									};
									t1 = vscode.window.createTerminal(options1);

									resolve({
										[termTag]: t0,
										[termTag1]: t1
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
	loadPage({ 'step': lastStep });
}

function loadPage (target: Target) {
	lastStep = target.step;

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

		log('debug', JSON.stringify(tokens[idx]));

		return  '<pre' + slf.renderAttrs(token) + ' title="Click <play button> to execute!"><code>' + '<a class="command_link" title="Click to execute!" class="button1" href="command:katapod.sendText?' + 
				renderCommandUri(tokens[idx].content) + '">▶</a>' + 
				md.utils.escapeHtml(tokens[idx].content) +
				'</code></pre>\n';
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

	panel.webview.html = pre + result + post;
	vscode.commands.executeCommand('notifications.clearAll');
}

function sendText (command: any) {
	// pick target terminal

	//
	let terminalIndex: number = command.terminal_index || 0;
	if (terminalIndex >= terminals.length){
		log('error', `Terminal index in command too high. Forcing it ${terminalIndex} --> ${terminals.length - 1}`);
		terminalIndex = terminals.length - 1;
	}
	terminals[terminalIndex].sendText(command.command);
	vscode.commands.executeCommand('notifications.clearAll');
}

function renderStepUri (step: string) {
	const uri = encodeURIComponent(JSON.stringify([{ 'step': step }])).toString();
	return uri;
}

function renderCommandUri (command: string) {
	const uri = encodeURIComponent(JSON.stringify([{ 'command': command }])).toString();
	return uri;
}

function getWorkingDir(): string | undefined {
	if (vscode.workspace.workspaceFolders) {
		return vscode.workspace.workspaceFolders[0].uri.path;
	}

	return vscode.workspace.rootPath;
}

function log (level: string, message: string) {
	console.log('KataPod ' + level.toUpperCase() + ' ' + message);
	// vscode.window.showInformationMessage(message);
}

export function deactivate() {}
