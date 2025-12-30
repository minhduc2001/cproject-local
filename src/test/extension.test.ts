import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as fs from 'fs';
import * as path from 'path';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	let sandbox: sinon.SinonSandbox;

	setup(() => {
		sandbox = sinon.createSandbox();
	});

	teardown(() => {
		sandbox.restore();
	});

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});

	test('should start a project from .cproject.json', async () => {
		const workspaceRoot = path.resolve('.');
		sandbox.stub(vscode.workspace, 'workspaceFolders').get(() => [{ uri: vscode.Uri.file(workspaceRoot), name: 'test-workspace', index: 0 }]);
		const configPath = path.join(workspaceRoot, '.cproject.json');

		const config = {
			projects: [
				{ name: 'Test Project', path: 'test/project', command: 'npm test' }
			]
		};
		fs.writeFileSync(configPath, JSON.stringify(config));

		const quickPickStub = sandbox.stub(vscode.window, 'showQuickPick').resolves({
			label: 'Test Project',
			project: config.projects[0]
		} as any);

		const terminalMock = {
			sendText: sinon.stub(),
			show: sinon.stub()
		};
		const createTerminalStub = sandbox.stub(vscode.window, 'createTerminal').returns(terminalMock as any);

		await vscode.commands.executeCommand('cproject-local.startProject');

		assert.ok(quickPickStub.calledOnce, 'showQuickPick was not called');
		assert.ok(createTerminalStub.calledOnceWith({ name: 'Test Project' }), 'createTerminal was not called with the correct name');
		
		const projectPath = vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), 'test/project').fsPath;
		assert.ok(terminalMock.sendText.calledWith(`cd "${projectPath}"`), 'cd command was not sent');
		assert.ok(terminalMock.sendText.calledWith('npm test'), 'project command was not sent');
		assert.ok(terminalMock.show.calledOnce, 'terminal was not shown');

		fs.unlinkSync(configPath); // Clean up the dummy file
	});
});
