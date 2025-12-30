import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface ProjectConfig {
	name: string;
	path: string;
	scripts: string[];
	detectedPM?: string;
}

interface ScriptNode {
	script: string;
	project: ProjectConfig;
	pm?: string;
}

// key = `${project.name}:${script}`
const runningScripts = new Map<string, vscode.Terminal>();
const scriptPMs = new Map<string, string>(); // lưu PM riêng từng script

export async function activate(context: vscode.ExtensionContext) {
	console.log('cproject-local activated');

	const projectsProvider = new ProjectsProvider(context);
	vscode.window.registerTreeDataProvider(
		'cproject-local.treeView',
		projectsProvider
	);

	// -------------------------
	// Terminal close event
	// -------------------------
	vscode.window.onDidCloseTerminal((terminal) => {
		for (const [key, term] of runningScripts) {
			if (term === terminal) {
				runningScripts.delete(key);
			}
		}
		projectsProvider.refresh();
	});

	// -------------------------
	// Run script
	// -------------------------
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'cproject-local.runScript',
			async (node: ScriptNode) => {
				const workspace = vscode.workspace.workspaceFolders?.[0];
				if (!workspace) return;

				const key = `${node.project.name}:${node.script}`;
				const pm = scriptPMs.get(key) || node.project.detectedPM || 'npm';

				const command = pm === 'npm' ? `npm run ${node.script}` : `${pm} ${node.script}`;
				const projectPath = vscode.Uri.joinPath(workspace.uri, node.project.path).fsPath;

				// Stop nếu terminal cũ vẫn còn
				if (runningScripts.has(key)) {
					const oldTerm = runningScripts.get(key)!;
					oldTerm.sendText('\x03');
					oldTerm.dispose();
					runningScripts.delete(key);
				}

				const terminal = vscode.window.createTerminal({ name: key });
				runningScripts.set(key, terminal);
				terminal.sendText(`cd "${projectPath}"`);
				terminal.sendText(command);
				terminal.show();

				projectsProvider.refresh();
			}
		)
	);

	// -------------------------
	// Stop script
	// -------------------------
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'cproject-local.stopScript',
			async (node: ScriptNode) => {
				const key = `${node.project.name}:${node.script}`;
				const terminal = runningScripts.get(key);
				if (terminal) {
					runningScripts.delete(key); // delete trước
					terminal.sendText('\x03');
					terminal.dispose();
				}
				projectsProvider.refresh();
			}
		)
	);

	// -------------------------
	// Change PM
	// -------------------------
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'cproject-local.changePM',
			async (node: ScriptNode) => {
				const pmOptions = ['npm', 'yarn', 'pnpm', 'bun'];
				const selectedPM = await vscode.window.showQuickPick(pmOptions, {
					placeHolder: 'Select package manager for this script',
					ignoreFocusOut: true,
				});
				if (!selectedPM) return;

				const key = `${node.project.name}:${node.script}`;
				scriptPMs.set(key, selectedPM);
				projectsProvider.refresh();
			}
		)
	);

	// -------------------------
	// Refresh projects
	// -------------------------
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'cproject-local.refreshProjects',
			() => projectsProvider.refresh()
		)
	);

	// -------------------------
	// Detect projects
	// -------------------------
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'cproject-local.detectProjects',
			async () => {
				const workspace = vscode.workspace.workspaceFolders?.[0];
				if (!workspace) return;

				const workspaceRoot = workspace.uri;
				const packageJsonFiles = await vscode.workspace.findFiles('**/package.json', '**/node_modules/**');
				if (!packageJsonFiles.length) {
					vscode.window.showInformationMessage('No package.json found in workspace.');
					return;
				}

				const PM_PRIORITY = ['npm', 'yarn', 'bun', 'pnpm'];
				const projects: ProjectConfig[] = [];

				for (const file of packageJsonFiles) {
					const projectDir = path.dirname(file.fsPath);
					const relativePath = path.relative(workspaceRoot.fsPath, projectDir);

					try {
						const raw = await vscode.workspace.fs.readFile(file);
						const pkg = JSON.parse(raw.toString());
						const scripts = Object.keys(pkg.scripts || {});
						if (scripts.length === 0) continue;

						const pmCandidates: string[] = [];
						if (fs.existsSync(path.join(projectDir, 'package-lock.json'))) pmCandidates.push('npm');
						if (fs.existsSync(path.join(projectDir, 'yarn.lock'))) pmCandidates.push('yarn');
						if (fs.existsSync(path.join(projectDir, 'pnpm-lock.yaml'))) pmCandidates.push('pnpm');
						if (fs.existsSync(path.join(projectDir, 'bun.lockb'))) pmCandidates.push('bun');

						const detectedPM = PM_PRIORITY.find(pm => pmCandidates.includes(pm)) || 'npm';

						projects.push({
							name: pkg.name || path.basename(projectDir),
							path: relativePath,
							scripts,
							detectedPM,
						});
					} catch { }
				}

				const configFileUri = vscode.Uri.joinPath(workspaceRoot, '.cproject.json');
				await vscode.workspace.fs.writeFile(
					configFileUri,
					Buffer.from(JSON.stringify({ projects }, null, 2), 'utf8')
				);

				projectsProvider.refresh();
			}
		)
	);
}

// ==========================
// Tree Provider
// ==========================
class ProjectsProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
	private _onDidChangeTreeData = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	private projects: ProjectConfig[] = [];

	constructor(private context: vscode.ExtensionContext) { }

	refresh() {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
		return element;
	}

	async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
		if (!element) {
			const workspace = vscode.workspace.workspaceFolders?.[0];
			if (!workspace) return [];

			const configPath = vscode.Uri.joinPath(workspace.uri, '.cproject.json').fsPath;
			if (!fs.existsSync(configPath)) return [];

			try {
				const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
				this.projects = config.projects || [];
				return this.projects.map(p => this.createProjectItem(p));
			} catch {
				return [];
			}
		} else if (element.contextValue === 'project') {
			const project = (element as any).project as ProjectConfig;
			return project.scripts.map(s => this.createScriptItem(s, project));
		}

		return [];
	}

	private createProjectItem(project: ProjectConfig): vscode.TreeItem {
		const item = new vscode.TreeItem(project.name, vscode.TreeItemCollapsibleState.Collapsed);
		item.contextValue = 'project';
		(item as any).project = project;
		item.iconPath = path.join(this.context.extensionPath, 'resources', 'icons', 'activity.svg');
		return item;
	}

	private createScriptItem(script: string, project: ProjectConfig): vscode.TreeItem {
		const key = `${project.name}:${script}`;
		const isRunning = runningScripts.has(key);
		const pm = scriptPMs.get(key) || project.detectedPM || 'npm';

		const item = new vscode.TreeItem(`${script} [${pm}]`, vscode.TreeItemCollapsibleState.None);
		item.contextValue = 'script';
		(item as any).project = project;
		(item as any).script = script;
		item.tooltip = `${script} (${pm})`;
		item.iconPath = path.join(
			this.context.extensionPath,
			'resources',
			'icons',
			isRunning ? 'running.svg' : 'stopped.svg'
		);

		// click script → run/stop
		item.command = {
			command: isRunning ? 'cproject-local.stopScript' : 'cproject-local.runScript',
			title: isRunning ? 'Stop' : 'Run',
			arguments: [{ script, project }]
		};

		// thêm context menu để đổi PM
		item.contextValue = 'scriptWithPM';

		return item;
	}
}

export function deactivate() {
	runningScripts.forEach(term => {
		term.sendText('\x03');
		term.dispose();
	});
	runningScripts.clear();
}
