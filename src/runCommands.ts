/*
Tools to run commands and scripts on the terminals.
*/

import * as vscode from 'vscode';
const path = require('path');

import {log} from './logging';
// import {getWorkingDir} from './filesystem';
import {ConfigCommand} from './configuration';

export function sendTextToTerminal (cbContent: any, env: any) {
	// pick target terminal, with care and fallbacks
	const terminalId: string = (cbContent.runSettings || {}).terminalId;
	const targetTerminal: vscode.Terminal = env.components.terminalMap[terminalId] || env.components.terminals[0];
	// run the command
	targetTerminal.sendText(cbContent.command);
	vscode.commands.executeCommand('notifications.clearAll');
}

export function sendTextsPerTerminal(commandMap: {[terminalId: string]: ConfigCommand}, env: any, logContext: string){
	Object.entries(commandMap).forEach(([terminalId, command]) => {
		log('info', `${logContext}: calling "${JSON.stringify(command)}" on terminal "${terminalId}"`);
		sendTextToTerminal(
            {
                runSettings: {
                    terminalId: terminalId,
                },
                ...command,
            },
			env
        );
	});
}

// export function runInitScripts (env: any) {
// 	let config = env.configuration;
// 	if (!config.startup){
// 		// legacy mode:
// 		const waitsh = vscode.Uri.file(path.join(getWorkingDir(), 'wait.sh'));
// 		vscode.workspace.fs.stat(waitsh).then(
// 			function(){
// 				log('debug', 'Executing wait.sh... (legacy mode)');
// 				sendTextToTerminal(
//                     {
//                         runSettings: {
//                             terminal: 'cqlsh',
//                         },
//                         command: './wait.sh',
//                     },
// 					env
//                 );
// 			}, 
// 			function () {log('debug', 'Skipping wait, wait.sh not found (legacy mode).');}
// 		);
// 	} else {
// 		const startupScripts = config.startup || {};
// 		// this maps terminal tags to startup commands to execute there
// 		sendTextsPerTerminal(startupScripts, env, "startup");
// 	}
// }
