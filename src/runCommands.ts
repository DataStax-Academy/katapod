/*
Tools to run commands and scripts on the terminals.
*/

import * as vscode from 'vscode';
const path = require('path');

import {log} from './logging';
import {ConfigCommand} from './configuration';

// Command-execution-specific structures
export interface FullCommand extends ConfigCommand {
	terminalId?: string;
}


export function runCommand (fullCommand: FullCommand, env: any) {
	// pick target terminal, with care and fallbacks
	const targetTerminal: vscode.Terminal = (
		fullCommand.terminalId?
		env.components.terminalMap[fullCommand.terminalId]:
		env.components.terminals[0]
	);
	// run the command
	log('info', `[runCommand]: Running "${JSON.stringify(fullCommand)}"`);
	targetTerminal.sendText(fullCommand.command);
	vscode.commands.executeCommand('notifications.clearAll');
}

export function runCommandsPerTerminal (commandMap: {[terminalId: string]: ConfigCommand}, env: any, logContext: string){
	Object.entries(commandMap).forEach(([terminalId, configCommand]) => {
		log('info', `[runCommandsPerTerminal/${logContext}]: running map entry "${terminalId}"/"${JSON.stringify(configCommand)}"`);
		const fullCommand: FullCommand = {
			...{terminalId: terminalId},
			...configCommand,
		}
		runCommand(fullCommand, env);
	});
}
