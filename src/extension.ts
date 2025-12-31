import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface ProjectConfig {
	name: string;
	path: string;
	scripts: string[];
	detectedPM?: string;
	manual?: boolean;
}

// key = `${project.name}:${script}`
const runningScripts = new Map<string, vscode.Terminal>();

export async function activate(context: vscode.ExtensionContext) {
	console.log('cproject-local activated');

	const projectsProvider = new ProjectsProvider(context);
	vscode.window.registerTreeDataProvider(
		'cproject-local.treeView',
		projectsProvider
	);

	vscode.window.onDidCloseTerminal((terminal) => {
		for (const [key, term] of runningScripts) {
			if (term === terminal) runningScripts.delete(key);
		}
		projectsProvider.refresh();
	});

	const getConfigPath = () => {
		const workspace = vscode.workspace.workspaceFolders?.[0];
		if (!workspace) return '';
		return vscode.Uri.joinPath(workspace.uri, '.cproject.json').fsPath;
	};

	const loadConfig = (): { projects: ProjectConfig[]; blacklist: string[]; whitelist: string[] } => {
		const configPath = getConfigPath();
		if (!configPath || !fs.existsSync(configPath)) return { projects: [], blacklist: [], whitelist: [] };
		try {
			const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
			return { projects: cfg.projects || [], blacklist: cfg.blacklist || [], whitelist: cfg.whitelist || [] };
		} catch {
			return { projects: [], blacklist: [], whitelist: [] };
		}
	};

	const saveConfig = (projects: ProjectConfig[], blacklist: string[], whitelist: string[]) => {
		const configPath = getConfigPath();
		if (!configPath) return;
		fs.writeFileSync(configPath, JSON.stringify({ projects, blacklist, whitelist }, null, 2), 'utf8');
	};

	// ------------------------- Commands -------------------------

	context.subscriptions.push(
		vscode.commands.registerCommand('cproject-local.runScript', async (node: any) => {
			const workspace = vscode.workspace.workspaceFolders?.[0];
			if (!workspace) return;

			const key = `${node.project.name}:${node.script}`;
			const pm = node.project.detectedPM || 'npm';
			const command = pm === 'npm' ? `npm run ${node.script}` : `${pm} ${node.script}`;
			const projectPath = vscode.Uri.joinPath(workspace.uri, node.project.path).fsPath;

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
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('cproject-local.stopScript', async (node: any) => {
			const key = `${node.project.name}:${node.script}`;
			const terminal = runningScripts.get(key);
			if (terminal) {
				runningScripts.delete(key);
				terminal.sendText('\x03');
				terminal.dispose();
			}
			projectsProvider.refresh();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('cproject-local.deleteScript', async (node: any) => {
			const { projects, blacklist, whitelist } = loadConfig();
			const project = projects.find(p => p.path === node.project.path);
			if (project) {
				project.scripts = project.scripts.filter(s => s !== node.script);
				saveConfig(projects, blacklist, whitelist);
			}

			const key = `${node.project.name}:${node.script}`;
			const terminal = runningScripts.get(key);
			if (terminal) {
				terminal.sendText('\x03');
				terminal.dispose();
				runningScripts.delete(key);
			}

			projectsProvider.refresh();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('cproject-local.changePM', async (node: any) => {
			const project: ProjectConfig = node.project;
			const pmOptions = ['npm', 'yarn', 'pnpm', 'bun'];
			const selectedPM = await vscode.window.showQuickPick(pmOptions, {
				placeHolder: `Select package manager for project ${project.name}`,
				ignoreFocusOut: true,
			});
			if (!selectedPM) return;

			project.detectedPM = selectedPM;
			const { projects, blacklist, whitelist } = loadConfig();
			const idx = projects.findIndex(p => p.path === project.path);
			if (idx >= 0) {
				projects[idx].detectedPM = selectedPM;
				saveConfig(projects, blacklist, whitelist);
			}

			projectsProvider.refresh();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('cproject-local.markManual', async (node: any) => {
			const project: ProjectConfig = node.project;
			project.manual = !project.manual;

			const { projects, blacklist, whitelist } = loadConfig();
			const idx = projects.findIndex(p => p.path === project.path);
			if (idx >= 0) {
				projects[idx].manual = project.manual;
				saveConfig(projects, blacklist, whitelist);
			}

			vscode.window.showInformationMessage(
				`Project "${project.name}" is now ${project.manual ? 'Manual' : 'Auto-detect'}`
			);
			projectsProvider.refresh();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('cproject-local.deleteProject', async (node: any) => {
			const { projects, blacklist, whitelist } = loadConfig();
			const remainingProjects = projects.filter(p => p.path !== node.project.path);
			blacklist.push(node.project.path);
			saveConfig(remainingProjects, blacklist, whitelist);
			projectsProvider.refresh();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('cproject-local.addToWhitelist', async (node: any) => {
			const { projects, blacklist, whitelist } = loadConfig();
			if (!whitelist.includes(node.project.path)) {
				whitelist.push(node.project.path);
				saveConfig(projects, blacklist, whitelist);
				vscode.window.showInformationMessage(`Project "${node.project.name}" added to whitelist.`);
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('cproject-local.refreshProjects', () => projectsProvider.refresh())
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('cproject-local.detectProjects', async () => {
			await detectProjects(false);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('cproject-local.detectAllProjects', async () => {
			await detectProjects(true);
		})
	);

	async function detectProjects(ignoreBlacklist: boolean) {
		const workspace = vscode.workspace.workspaceFolders?.[0];
		if (!workspace) return;

		const workspaceRoot = workspace.uri;
		const packageJsonFiles = await vscode.workspace.findFiles('**/package.json', '**/node_modules/**');
		if (!packageJsonFiles.length) {
			vscode.window.showInformationMessage('No package.json found in workspace.');
			return;
		}

		const PM_PRIORITY = ['npm', 'yarn', 'bun', 'pnpm'];
		const { projects: oldProjects, blacklist: oldBlacklist, whitelist } = loadConfig();
		let projects: ProjectConfig[] = [];
		let blacklist = oldBlacklist || [];

		for (const file of packageJsonFiles) {
			const projectDir = path.dirname(file.fsPath);
			const relativePath = path.relative(workspaceRoot.fsPath, projectDir);

			// Nếu blacklist và không nằm whitelist, bỏ qua
			if (!ignoreBlacklist && blacklist.includes(relativePath) && !whitelist.includes(relativePath)) continue;

			try {
				const raw = await vscode.workspace.fs.readFile(file);
				const pkg = JSON.parse(raw.toString());
				const scripts = Object.keys(pkg.scripts || {});
				if (scripts.length === 0) continue;

				const existingProject = oldProjects.find(p => p.path === relativePath);
				if (existingProject?.manual) {
					projects.push(existingProject);
					continue;
				}

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
					manual: false
				});
			} catch { }
		}

		saveConfig(projects, blacklist, whitelist);
		projectsProvider.refresh();
	}
}

// ========================== Tree Provider ==========================
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
		const pm = project.detectedPM || 'npm';

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

		item.command = {
			command: isRunning ? 'cproject-local.stopScript' : 'cproject-local.runScript',
			title: isRunning ? 'Stop' : 'Run',
			arguments: [{ script, project }]
		};

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
