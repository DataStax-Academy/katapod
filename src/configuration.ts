/*
Loading, parsing, validating (and supplying well-informed defaults for) the Katapod configuration.
*/

const fs = require("fs");

import {buildFullFileUri, checkFileExists} from "./filesystem";
import {log} from "./logging";
import {ConfigCommand} from "./runCommands";

import {kpConfigFileName, kpDefaultStartupScript, kpDefaultTerminalName, kpDefaultTerminalID, kpDefaultIntroStepName} from "./configuration_constants";


// Structure of the config object
export interface ConfigTerminal {
	id: string;
	name: string;
}
export interface ConfigObject {
	layout: {
		terminals: Array<ConfigTerminal>;
	};
	navigation: {
		onLoadCommands: {
			[step: string]: {
				[terminalId: string]: Array<ConfigCommand>;
			}
		}
	}
}

// default configuration object, "bare" (without init scripts)
const staticDefaultKpConfig: ConfigObject = {
	layout: {
		terminals: [
			{
				id: kpDefaultTerminalID,
				name: kpDefaultTerminalName,
			},
		]
	},
	navigation: {
		onLoadCommands: {},
	}
};


export function readKatapodConfig(): Promise<ConfigObject> {
	/*
    Return a complete config object, either from file or with defaults.
	- If the config file is found, it is:
		loaded,
		validated
		and returned scrupolously (i.e. no educated guessed even, such as check for legacy "wait.sh").
	- If it's not found, a fallback to backward compatibility is done, with
		a default config (one-terminal, legacy naming etc)
		and further settings depending on educated guessed from the scenario content (such as whether "wait.sh" exists, etc)
    */
	const configPromise = new Promise<ConfigObject>((resolve) => {
		//
		const kpConfigFileUri = buildFullFileUri(kpConfigFileName);
		checkFileExists(kpConfigFileUri).then(
			function() {
				log("debug", "[readKatapodConfig] Reading config file");
				let cfgFromFile: ConfigObject;
				try {
					cfgFromFile = JSON.parse(fs.readFileSync(kpConfigFileUri.path, "utf8")) as ConfigObject;
				} catch {
					log("error", "[readKatapodConfig] Unparseable config file. Falling back to default.");
					cfgFromFile = staticDefaultKpConfig;
				}
				resolve(cfgFromFile);
			},
			function () {
				log("debug", "[readKatapodConfig] Config file not found. Falling back to default.");
				// check if the default startup script exists and adjust the constructed config
				const kpStartupScriptFileUri = buildFullFileUri(kpDefaultStartupScript);
				let cfgAutogenerated: ConfigObject;
				checkFileExists(kpStartupScriptFileUri).then(
					function() {
						log("debug", "[readKatapodConfig] Default init script found");
						cfgAutogenerated = {
							...staticDefaultKpConfig,
							...{
								navigation: {
									onLoadCommands: {
										[kpDefaultIntroStepName]: {
											[kpDefaultTerminalID]: [
												{
												  	command: `./${kpDefaultStartupScript};`,
												}
											]
										}
									}
								}
							}
						};
						resolve(cfgAutogenerated);
					},
					function() {
						log("debug", "[readKatapodConfig] Default init script not found");
						cfgAutogenerated = {
							...staticDefaultKpConfig,
						};
						resolve(cfgAutogenerated);
					}
				);
			}
		);
	});
	//
	return configPromise;
}
