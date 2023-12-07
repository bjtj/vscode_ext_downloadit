// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { writeFile } from 'fs/promises';
import * as fs from 'fs';
import path from 'path';
import { arrayBuffer } from 'stream/consumers';
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	let disposable2 = vscode.commands.registerCommand('downloadit.download', async (...commandArgs) => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user

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

		if (url) {
			let filename = path.basename(url);
			let destPath = path.join(basePath, filename);

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
			}) ?? destPath;

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

			vscode.window.showInformationMessage('Downloading is started...');

			let byteLength = 0;

			fetch(url, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/octet-stream'
				}
			})
				.then(response => response.arrayBuffer())
				.then(arrayBuffer => {
					byteLength = arrayBuffer.byteLength;
					return writeFile(destPath, Buffer.from(arrayBuffer));
				})
				.then(() => {
					vscode.window.showInformationMessage(`File downloaded (${byteLength.toLocaleString()} bytes) to "${destPath}"`);
				})
				.catch(error => {
					vscode.window.showErrorMessage(`Download failed due to "${error}"...`);
				});
		}

	});
	context.subscriptions.push(disposable2);
}

// This method is called when your extension is deactivated
export function deactivate() { }
