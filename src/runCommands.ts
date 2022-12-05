/*
Tools to run commands and scripts on the terminals.
*/

import * as vscode from 'vscode';

import {log} from './logging';
import {KatapodEnvironment} from './state';


export const cbIdSeparator = "_";


// Command-execution-specific structures
export interface ConfigCommand {
	command: string;
	execute?: boolean;
	maxInvocations?: number | "unlimited";
}
// the above would become the following, with defaults and added stuff
export interface FullCommand {
	command: string;
	execute?: boolean;
	terminalId?: string;
	codeBlockId: string;
	maxInvocations: number | "unlimited";
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
		// do we run the command?
		const invocationCountSoFar = env.state.codeInvocationCount[fullCommand.codeBlockId] || 0;
		if ( (fullCommand.maxInvocations === "unlimited") || (invocationCountSoFar < fullCommand.maxInvocations)){
			// run the command
			log('debug', `[runCommand]: Running ${JSON.stringify(fullCommand)} (invocations until now: ${invocationCountSoFar})`);
			// increment the execution counter for this command:
			env.state.codeInvocationCount[fullCommand.codeBlockId] = (env.state.codeInvocationCount[fullCommand.codeBlockId] || 0) +1;
			// actually launch the command:
			targetTerminal.sendText(fullCommand.command);
			vscode.commands.executeCommand('notifications.clearAll');
		} else {
			log('debug', `[runCommand]: Refusing to execute ${JSON.stringify(fullCommand)} (invocations detected: ${invocationCountSoFar})`);
		}
	} else {
		log('debug', `[runCommand]: Refusing to execute ${JSON.stringify(fullCommand)} ('execute' flag set to false)`);
	}
}

export function runCommandsPerTerminal(step: string, commandMap: {[terminalId: string]: ConfigCommand}, env: KatapodEnvironment, logContext: string) {
	Object.entries(commandMap).forEach(([terminalId, configCommand]) => {
		log('debug', `[runCommandsPerTerminal/${logContext}]: running map entry ${terminalId} => ${JSON.stringify(configCommand)}`);
		const fullCommand: FullCommand = {
			...{
				terminalId: terminalId,
				codeBlockId: `onLoad${cbIdSeparator}${step}${cbIdSeparator}${terminalId}`,
				maxInvocations: 1,
			},
			...configCommand,
		};
		runCommand(fullCommand, env);
	});
}
