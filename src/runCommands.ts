/*
Tools to run commands and scripts on the terminals.
*/

import * as vscode from 'vscode';
const path = require('path');

import {log} from './logging';
import {getWorkingDir} from './filesystem';


export function sendTextToTerminal (cbContent: any, env: any) {
	// pick target terminal, with care and fallbacks
	const targetTerminalTag: string = (cbContent.runSettings || {}).terminal;
	let targetTerminal: vscode.Terminal;
	if (targetTerminalTag){
		targetTerminal = env.components.terminalMap[targetTerminalTag];
		if (!targetTerminal){
			targetTerminal = env.components.terminals[0];
			log('debug', `sendText fails by name and falls to first`);
		}else{
			log('debug', `sendText picks terminal by name ${targetTerminalTag}`);
		}
	}else{
		targetTerminal = env.components.terminals[0];
		log('debug', `sendText picks first term by default`);
	}

	// run the command
	targetTerminal.sendText(cbContent.command);
	vscode.commands.executeCommand('notifications.clearAll');
}

export function sendTextsPerTerminal(commandMap: any, env: any, logContext: string){
	Object.entries(commandMap).forEach(([terminalTag, command]) => {
		log('info', `${logContext}: calling "${command}" on terminal "${terminalTag}"`);
		sendTextToTerminal(
            {
                runSettings: {
                    terminal: terminalTag,
                },
                command,
            },
			env
        );
	});
}

export function runInitScripts (env: any) {
	let config = env.configuration;
	if (!config.startup){
		// legacy mode:
		const waitsh = vscode.Uri.file(path.join(getWorkingDir(), 'wait.sh'));
		vscode.workspace.fs.stat(waitsh).then(
			function(){
				log('debug', 'Executing wait.sh... (legacy mode)');
				sendTextToTerminal(
                    {
                        runSettings: {
                            terminal: 'cqlsh',
                        },
                        command: './wait.sh',
                    },
					env
                );
			}, 
			function () {log('debug', 'Skipping wait, wait.sh not found (legacy mode).');}
		);
	} else {
		const startupScripts = config.startup || {};
		// this maps terminal tags to startup commands to execute there
		sendTextsPerTerminal(startupScripts, env, "startup");
	}
}
