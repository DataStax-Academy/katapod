/*
Logging facilities for the extension.
*/

export function log (level: string, message: string) {
	console.log('KataPod ' + level.toUpperCase() + ' ' + message);
}

export function double(x: number): number {
	/*
	dummy function to exemplify unit tests.
	*/
	return 2.0 * x;
}
