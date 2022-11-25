/*
Logging facilities for the extension.
*/

export function log (level: string, message: string) {
	console.log('KataPod ' + level.toUpperCase() + ' ' + message);
}
