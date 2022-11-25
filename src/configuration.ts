/*
Loading, parsing, validating (and supplying well-informed defaults for) the Katapod configuration.
*/

import * as vscode from 'vscode';
const path = require('path');
const fs = require('fs');

import {getWorkingDir} from './filesystem';
import {log} from './logging';


export function readKatapodConfig(): Promise<any> {
	/*
    Return a complete config object, either from file or with defaults.
    To sypply defaults, if needed, and cover legacy modes, this function can inspect the filesystem
    (e.g. to guess about a "wait.sh" script).

    If no config file is found, legacy mode is chosen: one terminal + possible call to wait.sh if the file exists.
    If a config file is found, no further guesses are made and that is the only source of settings.
    */

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
