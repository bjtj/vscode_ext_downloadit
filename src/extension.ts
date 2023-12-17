// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { writeFile } from 'fs/promises';
import * as fs from 'fs';
import path from 'path';
import * as vscode from 'vscode';

let myStatusBarItem: vscode.StatusBarItem;
let downloadingCount = 0;

function updateStatusBarItem() {
	if (downloadingCount > 0) {
		myStatusBarItem.text = `$(loading~spin) Download It: ${downloadingCount}`;
	} else {
		myStatusBarItem.text = `Download It: ${downloadingCount}`;
	}
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	let outputChannel = vscode.window.createOutputChannel('Download It');
	outputChannel.hide();

	const showOutputChannelCommandId = 'downloadit.showOutputChannel';

	context.subscriptions.push(vscode.commands.registerCommand(showOutputChannelCommandId, () => {
		outputChannel.show();
	}));

	myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	updateStatusBarItem();
	myStatusBarItem.command = showOutputChannelCommandId;
	myStatusBarItem.tooltip = 'Show Download It output';
	myStatusBarItem.show();


	async function readResponse(response: Response, size: number, onProgress: (progress: number) => void) {
		const reader = response.body?.getReader();
		if (!reader) {
			return Promise.reject('No Reader');
		}

		const chunks: Uint8Array[] = [];
		let currentSize = 0;
		for (; ;) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}

			chunks.push(value);
			currentSize += value.length;
			onProgress(currentSize / size);
		}

		return mergeArrayBuffers(chunks);
	}

	function mergeArrayBuffers(buffers: ArrayBuffer[]) {
		let totalLength = buffers.reduce((prev, curr) => prev + curr.byteLength, 0);
		let merged = new Uint8Array(totalLength);
		let offset = 0;
		for (let buffer of buffers) {
			merged.set(new Uint8Array(buffer), offset);
			offset += buffer.byteLength;
		}
		return merged.buffer;
	}


	let disposable2 = vscode.commands.registerCommand('downloadit.download', async (...commandArgs) => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user

		const outputAction = 'Show Output';
		const outputActionHandler = (selection: string | undefined) => {
			if (selection === outputAction) {
				outputChannel.show();
			}
		};

		let basePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath ?? '';
		if (commandArgs.length > 1 && commandArgs[0].fsPath) {
			basePath = commandArgs[0].fsPath;
		}

		const url = await vscode.window.showInputBox({
			placeHolder: 'Enter URL',
			value: context.globalState.get('url', 'http://'),
			title: 'Download URL',
			validateInput: (url: string) => {
				try {
					new URL(url);
					return null;
				} catch (e) {
					return 'Please enter a valid URL';
				}
			}
		});

		if (!url) {
			return;
		}

		let filename = path.basename(url);
		let destPath: string | undefined = path.join(basePath, filename);

		destPath = await vscode.window.showInputBox({
			title: 'Destination Path',
			placeHolder: 'Destination Path...',
			value: destPath,
			validateInput: (filename: string) => {
				if (!filename) {
					return 'Destination path is required';
				}
				return null;
			}
		});

		if (destPath === undefined) {
			return;
		}

		if (!fs.existsSync(path.dirname(destPath))) {
			let ret = await vscode.window.showInformationMessage(`Directory "${path.dirname(destPath)}" does not exist. Create it?`, 'Yes', 'No');
			if (ret === 'Yes') {
				fs.mkdirSync(path.dirname(destPath));
			}
		}

		if (fs.existsSync(destPath)) {
			let ret = await vscode.window.showInformationMessage(`File already exists (${destPath}). Overwrite it?`, 'Yes', 'No');
			if (ret !== 'Yes') {
				vscode.window.showInformationMessage('Download cancelled');
				return;
			}
		}

		context.globalState.update('url', url);
		outputChannel.appendLine(`Started: ${url} >>> ${destPath}`);
		vscode.window.showInformationMessage('Downloading is started...', outputAction).then(outputActionHandler);

		let byteLength = 0;
		let prevPercent: number = -1;
		let startTime = Date.now();
		let message = '';

		fetch(url, {
			method: 'GET',
			headers: {
				'Accept-Encoding': 'none',
			}
		})
			.then(response => {

				downloadingCount++;
				updateStatusBarItem();

				if (!response.ok) {
					throw new Error(response.statusText);
				}
				const length = response.headers.get('Content-Length');
				if (!length) {
					return response.arrayBuffer();
				}
				return readResponse(response, parseInt(length), progress => {
					let percent = Math.floor(progress * 100);
					let percentStr = percent.toString().padStart(3, ' ');
					if (percent !== prevPercent) {
						outputChannel.appendLine(`[${percentStr}%] ${url} >>> ${destPath}`);
					}
					prevPercent = percent;
				});
			})
			.then(arrayBuffer => {
				byteLength = arrayBuffer.byteLength;
				return writeFile(destPath!, Buffer.from(arrayBuffer));
			})
			.then(() => {
				message = `Completed: "${destPath}" (${byteLength.toLocaleString()} bytes)`;
			})
			.catch(error => {
				message = `Failed due to "${error}"...`;
				outputChannel.show();
			}).finally(() => {

				let duration = Date.now() - startTime;
				let durationSec = (duration / 1000).toFixed(3);
				let durationSecStr = durationSec.toLocaleString();

				let msg = `${message} [elapsed: ${durationSecStr} sec.]`;

				outputChannel.appendLine(msg);
				vscode.window.showInformationMessage(msg, outputAction).then(outputActionHandler);

				downloadingCount--;
				updateStatusBarItem();
			});
	});
	context.subscriptions.push(disposable2);
}


// This method is called when your extension is deactivated
export function deactivate() { }
