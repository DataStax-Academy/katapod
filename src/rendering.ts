/*
Parsing/rendering markdown, code blocks and other elements.
*/

import * as vscode from 'vscode';
const fs = require('fs');
const markdownIt = require('markdown-it');
const markdownItAttrs = require('markdown-it-attrs');

import {runCommandsPerTerminal, ConfigCommand, FullCommand, cbIdSeparator} from './runCommands';
import {buildFullFileUri} from './filesystem';
import {KatapodEnvironment} from './state';
import {log} from './logging';


const executionInfoPrefix = "### ";

// NOTE: this interface *must* be such that it lacks just
// the "command" field in order to be a FullCommand
interface CodeBlockExecutionInfo {
    terminalId?: string;
    execute?: boolean;
}

export interface TargetStep {
	step: string;
}


function parseCodeBlockContent(step: string, index: number, cbContent: string): FullCommand {
    /*
    Parse a code-block "raw string", such as
        ### {"terminalId": "myTermId"}
        ls
    or
        ls
    or
        ### myTermId
    into a FullCommand object.
    Notes:
        - Codeblocks with no "### "-prefixed lines will just work
        - For codeblocks with multiple "### ", only the last one is used
          and the previous ones are silently discarded.
    */
    let actualLines: Array<string> = [];
    let infoLine: string | undefined = undefined;
    const rawLines = cbContent.split('\n');
    //
	rawLines.forEach( (line) => {
		if (line.slice(0,4) === executionInfoPrefix) {
			infoLine = line.slice(executionInfoPrefix.length).trim();
		}else{
			actualLines.push(line);
		}
	});
    //
    const bareCommand: string = actualLines.join('\n');
	const contextData = {
		codeBlockId: `inPage${cbIdSeparator}${step}${cbIdSeparator}${index}`,
	};
    //
    if (infoLine) {
        // this might be just-a-terminal-Id, a fully-formed JSON
        let executionInfo: CodeBlockExecutionInfo;
        try{
            executionInfo = JSON.parse(infoLine) as CodeBlockExecutionInfo;
        }catch(e) {
            // we take the line to be a naked terminalId
            executionInfo = {terminalId: infoLine};
        }
        return {
			...contextData,
            ...executionInfo,
            ...{command: bareCommand},
        };
    }else{
        return {
			...contextData,
			...{
            	command: bareCommand,
			},
        };
    }
}

function renderStepUri(step: string): string {
	const uri = encodeURIComponent(JSON.stringify([{ 'step': step }])).toString();
	return uri;
}

function renderCommandUri(fullCommand: FullCommand): string {
	const uri = encodeURIComponent(JSON.stringify([fullCommand])).toString();
	return uri;
}

export function reloadPage(command: any, env: KatapodEnvironment) {
	const currentStep = env.state.stepHistory.slice(-1)[0];
	if (typeof currentStep === "string") {
		loadPage({step: currentStep}, env);
	}
}

export function loadPage(target: TargetStep, env: KatapodEnvironment) {
	env.state.stepHistory.push(target.step);
	log('debug', `[loadPage] Step history: ${env.state.stepHistory.map(s => s.toString()).join(" => ")}`);

	const file = buildFullFileUri(`${target.step}.md`);

	const md = new markdownIt({html: true})
		.use(require('markdown-it-textual-uml'))
		.use(markdownItAttrs);

	let blockIndex = 0;

	// process codeblocks
	md.renderer.rules.fence_default = md.renderer.rules.fence;
	md.renderer.rules.fence = function (tokens: any, idx: any, options: any, env: any, slf: any) {
		var token = tokens[idx],
			info = token.info ? md.utils.unescapeAll(token.info).trim() : '';

		if (info) { // Fallback to the default processor
			return md.renderer.rules.fence_default(tokens, idx, options, env, slf);
		}

		const parsedCommand: FullCommand = parseCodeBlockContent(target.step, blockIndex, tokens[idx].content);
		blockIndex++;

		if(parsedCommand.execute !== false) {
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

	env.components.panel.webview.html = pre + result + post;

	// process step-scripts, if present:
	const stepScripts = (env.configuration.navigation?.onLoadCommands || {})[target.step] || {} as {[terminalId: string]: ConfigCommand};
	runCommandsPerTerminal(target.step, stepScripts, env, `onLoad[${target.step}]`);

	vscode.commands.executeCommand('notifications.clearAll');
}
