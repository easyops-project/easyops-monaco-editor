export interface IValidatorError {
	lineNumber: number;
	characterIndex: number;
	characterCount: number;
	line: string;
	severity: string;
	errorCode: string;
	errorMessage: string;
	hint: string;
}