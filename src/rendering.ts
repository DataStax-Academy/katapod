/*
Parsing/rendering markdown, code blocks and other elements.
*/

import {FullCommand} from './runCommands';

const executionInfoPrefix = "### ";

// this interface must lack just "command" to be a FullCommand
interface CodeBlockExecutionInfo {
    terminalId?: string;
    execute?: boolean;
}


export function parseCodeBlockContent(cbContent: string): FullCommand {
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
		if (line.slice(0,4) === executionInfoPrefix){
			infoLine = line.slice(executionInfoPrefix.length).trim();
		}else{
			actualLines.push(line);
		}
	});
    //
    const bareCommand: string = actualLines.join('\n');
    //
    if (infoLine){
        // this might be just-a-terminal-Id, a fully-formed JSON
        let executionInfo: CodeBlockExecutionInfo;
        try{
            executionInfo = JSON.parse(infoLine) as CodeBlockExecutionInfo;
        }catch(e) {
            // we take the line to be a naked terminalId
            executionInfo = {terminalId: infoLine};
        }
        return {
            ...executionInfo,
            ...{command: bareCommand},
        }
    }else{
        return {
            command: bareCommand,
        };
    }
}
