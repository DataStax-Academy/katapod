/*
Logging facilities for the extension.
*/

type logLevel = "debug" | "warning" | "error";


const logTitle = 'KataPod';


export function log(level: logLevel, message: string) {
	console.log(buildLogMessage(level, message));
}

export function buildLogMessage(level: logLevel, message: string) {
	return `${logTitle} [${level.toUpperCase()}] ${message}`;
}
