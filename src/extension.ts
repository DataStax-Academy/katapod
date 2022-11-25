const { syncBuiltinESMExports } = require('module');
import { waitForDebugger } from 'inspector';
import * as vscode from 'vscode';
const path = require('path');
const fs = require('fs');
const markdownIt = require('markdown-it');
const markdownItAttrs = require('markdown-it-attrs');

import {readKatapodConfig} from './configuration';
import {getWorkingDir} from './filesystem';
import {log} from './logging';
// import {sendText, sendTextsPerTerminal, runInitScripts} from './runCommands';

let terminals: vscode.Terminal[];
let terminalMap: any;
let kpConfig: any;
let panel: vscode.WebviewPanel;
let lastStep: string;

// let kpEnvironment: any = {
// 	components: {
// 		terminals: vscode.Terminal[],
// 		terminalMap: any,
// 		panel: vscode.WebviewPanel,
// 	},
// 	configuration: any,
// 	state: {
// 		lastStep: string,
// 	}
// };

export function sendText (cbContent: any) {
	// pick target terminal, with care and fallbacks
	const targetTerminalTag: string = (cbContent.runSettings || {}).terminal;
	let targetTerminal: vscode.Terminal;
	if (targetTerminalTag){
		targetTerminal = terminalMap[targetTerminalTag];
		if (!targetTerminal){
			targetTerminal = terminals[0];
			log('debug', `sendText fails by name and falls to first`);
		}else{
			log('debug', `sendText picks terminal by name ${targetTerminalTag}`);
		}
	}else{
		targetTerminal = terminals[0];
		log('debug', `sendText picks first term by default`);
	}

	// run the command
	targetTerminal.sendText(cbContent.command);
	vscode.commands.executeCommand('notifications.clearAll');
}

export function sendTextsPerTerminal(commandMap: any, logContext: string){
	Object.entries(commandMap).forEach(([terminalTag, command]) => {
		log('info', `${logContext}: calling "${command}" on terminal "${terminalTag}"`);
		sendText(
            {
                runSettings: {
                    terminal: terminalTag,
                },
                command,
            }
        );
	});
}

export function runInitScripts (config: any) {
	if (!config.startup){
		// legacy mode:
		const waitsh = vscode.Uri.file(path.join(getWorkingDir(), 'wait.sh'));
		vscode.workspace.fs.stat(waitsh).then(
			function(){
				log('debug', 'Executing wait.sh... (legacy mode)');
				sendText(
                    {
                        runSettings: {
                            terminal: 'cqlsh',
                        },
                        command: './wait.sh',
                    }
                );
			}, 
			function () {log('debug', 'Skipping wait, wait.sh not found (legacy mode).');}
		);
	} else {
		const startupScripts = config.startup || {};
		// this maps terminal tags to startup commands to execute there
		sendTextsPerTerminal(startupScripts, "startup");
	}
}


export async function activate(context: vscode.ExtensionContext) {
	/*
	Nothing seems to prevent this function from being async (which helps fighting nondeterminism in these calls).
	See https://stackoverflow.com/questions/64640967/can-a-vscode-extension-activate-method-be-async.
	*/
	context.subscriptions.push(vscode.commands.registerCommand('katapod.sendText', sendText));
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
					runInitScripts(kpConfig);
					log('debug', 'ready to rock.');
				},
				rejected => log('error', rejected)
			);
		},
		rej => log('error', rej)
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

function parseCodeBlockContent(cbContent: string) {
	// filter out lines starting with "###" and make them into the target-terminal-tag directive
	let targetTermTag: string = '';
	const lines = cbContent.split('\n');
	let cleanContent: string[] = [];
	lines.forEach( (line) => {
		if (line.slice(0,3) ==='###'){
			targetTermTag = line.slice(3).trim();
		}else{
			cleanContent.push(line);
		}
	});
	if (targetTermTag){
		return {
			command: cleanContent.join('\n'),
			runSettings: {terminal: targetTermTag}
		};
	}else{
		return {
			command: cleanContent.join('\n')
		};
	}
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

		log('debug', `TOKEN => ${JSON.stringify(tokens[idx])}`);

		const parsedContent = parseCodeBlockContent(tokens[idx].content);
		const {command} = parsedContent;

		return  '<pre' + slf.renderAttrs(token) + ' title="Click <play button> to execute!"><code>' + '<a class="command_link" title="Click to execute!" class="button1" href="command:katapod.sendText?' + 
				renderCommandUri(parsedContent) + '">▶</a>' + 
				md.utils.escapeHtml(command) +
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

	// process step-scripts if any
	const stepScripts = (kpConfig.stepScripts || {})[target.step] || {};
	sendTextsPerTerminal(stepScripts, `onLoad[${target.step}]`);

	vscode.commands.executeCommand('notifications.clearAll');
}

function renderStepUri (step: string) {
	const uri = encodeURIComponent(JSON.stringify([{ 'step': step }])).toString();
	return uri;
}

function renderCommandUri (parsedCbContent: any) {
	const uri = encodeURIComponent(JSON.stringify([parsedCbContent])).toString();
	return uri;
}

