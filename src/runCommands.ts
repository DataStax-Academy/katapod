/*
Tools to run commands and scripts on the terminals.
*/

import * as vscode from 'vscode';

import {log} from './logging';
import {KatapodEnvironment} from './state';


// Command-execution-specific structures
export interface ConfigCommand {
	command: string;
	execute?: boolean;
}
export interface FullCommand extends ConfigCommand {
	terminalId?: string;
}


export function runCommand(fullCommand: FullCommand, env: KatapodEnvironment) {
	// i.e. only if *explicitly* false (a default of true implemented)
	if (fullCommand.execute !== false) {
		// pick target terminal, with care and fallbacks
		const targetTerminal: vscode.Terminal = (
			fullCommand.terminalId?
			env.components.terminalMap[fullCommand.terminalId]:
			env.components.terminals[0]
		) || env.components.terminals[0];
		// run the command
		log('debug', `[runCommand]: Running ${JSON.stringify(fullCommand)}`);
		targetTerminal.sendText(fullCommand.command);
		vscode.commands.executeCommand('notifications.clearAll');
	} else {
		log('debug', `[runCommand]: Refusing to execute ${JSON.stringify(fullCommand)}`);
	}
}

export function runCommandsPerTerminal(commandMap: {[terminalId: string]: ConfigCommand}, env: KatapodEnvironment, logContext: string) {
	Object.entries(commandMap).forEach(([terminalId, configCommand]) => {
		log('debug', `[runCommandsPerTerminal/${logContext}]: running map entry ${terminalId} => ${JSON.stringify(configCommand)}`);
		const fullCommand: FullCommand = {
			...{terminalId: terminalId},
			...configCommand,
		};
		runCommand(fullCommand, env);
	});
}
