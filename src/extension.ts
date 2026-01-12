import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

type ProjectType = 'nodejs' | 'docker';

interface DockerComposeFile {
	file: string;
	label: string;
	commands: string[];
}

interface ProjectConfig {
	name: string;
	path: string;
	scripts: string[];
	type: ProjectType;
	detectedPM?: string;
	dockerComposeFiles?: DockerComposeFile[];
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
		const config = vscode.workspace.getConfiguration('cproject-local');
		let customPath = config.get<string>('configPath', '').trim();

		if (customPath) {
			if (customPath.startsWith('~')) {
				customPath = path.join(os.homedir(), customPath.slice(1));
			}

			const dirPath = path.isAbsolute(customPath) ? customPath : path.resolve(customPath);
			if (!fs.existsSync(dirPath)) {
				try {
					fs.mkdirSync(dirPath, { recursive: true });
				} catch (error) {
					vscode.window.showErrorMessage(`Failed to create config directory: ${error}`);
					return '';
				}
			}

			return path.join(dirPath, '.cproject.json');
		}

		// Default: use workspace root
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
			const project: ProjectConfig = node.project;
			const composeFile: DockerComposeFile | undefined = node.composeFile;

			let key: string;
			if (composeFile) {
				key = `${project.name}:${composeFile.label}:${node.script}`;
			} else {
				key = `${project.name}:${node.script}`;
			}

			let command: string;
			if (project.type === 'docker') {
				if (composeFile) {
					command = `docker-compose -f ${composeFile.file} ${node.script}`;
				} else {
					command = `docker-compose ${node.script}`;
				}
			} else {
				const pm = project.detectedPM || 'npm';
				command = pm === 'npm' ? `npm run ${node.script}` : `${pm} ${node.script}`;
			}

			const workspace = vscode.workspace.workspaceFolders?.[0];
			if (!workspace) return;
			const projectPath = vscode.Uri.joinPath(workspace.uri, project.path).fsPath;

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
			const composeFile: DockerComposeFile | undefined = node.composeFile;

			let key: string;
			if (composeFile) {
				key = `${node.project.name}:${composeFile.label}:${node.script}`;
			} else {
				key = `${node.project.name}:${node.script}`;
			}

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

	context.subscriptions.push(
		vscode.commands.registerCommand('cproject-local.changeConfigPath', async () => {
			const config = vscode.workspace.getConfiguration('cproject-local');
			const currentPath = config.get<string>('configPath', '');

			const options: vscode.QuickPickItem[] = [
				{
					label: '$(folder) Workspace Root (Default)',
					description: 'Save .cproject.json in workspace root',
					detail: currentPath === '' ? '✓ Currently selected' : ''
				},
				{
					label: '$(folder-opened) Choose Custom Folder',
					description: 'Select a custom folder to save config',
					detail: currentPath !== '' ? `Current: ${currentPath}` : ''
				},
				{
					label: '$(home) User Home Directory',
					description: 'Save in ~/.cproject/',
					detail: currentPath === '~/.cproject' ? '✓ Currently selected' : ''
				}
			];

			const selected = await vscode.window.showQuickPick(options, {
				placeHolder: 'Where do you want to save the .cproject.json file?'
			});

			if (!selected) return;

			let newPath = '';

			if (selected.label.includes('Workspace Root')) {
				newPath = '';
			} else if (selected.label.includes('User Home')) {
				newPath = '~/.cproject';
			} else if (selected.label.includes('Choose Custom')) {
				const folderUri = await vscode.window.showOpenDialog({
					canSelectFiles: false,
					canSelectFolders: true,
					canSelectMany: false,
					openLabel: 'Select Config Folder',
					title: 'Select folder to save .cproject.json'
				});

				if (!folderUri || folderUri.length === 0) return;
				newPath = folderUri[0].fsPath;
			}

			await config.update('configPath', newPath, vscode.ConfigurationTarget.Global);

			vscode.window.showInformationMessage(
				newPath === ''
					? 'Config will be saved in workspace root'
					: `Config will be saved in: ${newPath}`
			);

			projectsProvider.refresh();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('cproject-local.searchProjects', async () => {
			const allProjects = projectsProvider.getAllProjects();

			if (allProjects.length === 0) {
				vscode.window.showInformationMessage('No projects found. Add projects first.');
				return;
			}

			interface SearchItem {
				label: string;
				description: string;
				detail: string;
				project: ProjectConfig;
				script?: string;
				composeFile?: DockerComposeFile;
			}

			const items: SearchItem[] = [];

			for (const project of allProjects) {
				const typeLabel = project.type === 'docker' ? 'Docker' : 'Node.js';
				items.push({
					label: `$(folder) ${project.name}`,
					description: typeLabel,
					detail: project.path,
					project
				});

				if (project.type === 'docker' && project.dockerComposeFiles) {
					for (const composeFile of project.dockerComposeFiles) {
						for (const cmd of composeFile.commands) {
							const key = `${project.name}:${composeFile.label}:${cmd}`;
							const isRunning = runningScripts.has(key);

							const scriptLabel = `${composeFile.label}: ${cmd}`;

							items.push({
								label: `$(run) ${scriptLabel}`,
								description: `${project.name} [${composeFile.file}] ${isRunning ? '(Running)' : ''}`,
								detail: project.path,
								project,
								script: cmd,
								composeFile: composeFile
							});
						}
					}
				} else {
					for (const script of project.scripts) {
						const key = `${project.name}:${script}`;
						const isRunning = runningScripts.has(key);

						const scriptDesc = `${project.name} [${project.detectedPM}] ${isRunning ? '(Running)' : ''}`;

						items.push({
							label: `$(run) ${script}`,
							description: scriptDesc,
							detail: project.path,
							project,
							script
						});
					}
				}
			}

			const selected = await vscode.window.showQuickPick(items, {
				placeHolder: 'Search projects and scripts...',
				matchOnDescription: true,
				matchOnDetail: true
			});

			if (!selected) return;

			if (selected.script) {
				let key: string;
				if (selected.composeFile) {
					key = `${selected.project.name}:${selected.composeFile.label}:${selected.script}`;
				} else {
					key = `${selected.project.name}:${selected.script}`;
				}

				const isRunning = runningScripts.has(key);

				if (isRunning) {
					const terminal = runningScripts.get(key);
					if (terminal) {
						runningScripts.delete(key);
						terminal.sendText('\x03');
						terminal.dispose();
					}
				} else {
					let command: string;
					if (selected.project.type === 'docker') {
						if (selected.composeFile) {
							command = `docker-compose -f ${selected.composeFile.file} ${selected.script}`;
						} else {
							command = `docker-compose ${selected.script}`;
						}
					} else {
						const pm = selected.project.detectedPM || 'npm';
						command = pm === 'npm' ? `npm run ${selected.script}` : `${pm} ${selected.script}`;
					}

					if (runningScripts.has(key)) {
						const oldTerm = runningScripts.get(key)!;
						oldTerm.sendText('\x03');
						oldTerm.dispose();
						runningScripts.delete(key);
					}

					const workspace = vscode.workspace.workspaceFolders?.[0];
					if (!workspace) return;
					const projectPath = vscode.Uri.joinPath(workspace.uri, selected.project.path).fsPath;

					const terminal = vscode.window.createTerminal({ name: key });
					runningScripts.set(key, terminal);
					terminal.sendText(`cd "${projectPath}"`);
					terminal.sendText(command);
					terminal.show();
				}

				projectsProvider.refresh();

				projectsProvider.refresh();
			} else {
				const action = await vscode.window.showQuickPick(
					[
						{ label: 'Open in New Window', action: 'open' },
						{ label: 'Add to Workspace', action: 'add' }
					],
					{ placeHolder: `What would you like to do with "${selected.project.name}"?` }
				);

				if (!action) return;

				const projectUri = vscode.Uri.file(selected.project.path);

				if (action.action === 'open') {
					vscode.commands.executeCommand('vscode.openFolder', projectUri, true);
				} else if (action.action === 'add') {
					vscode.workspace.updateWorkspaceFolders(
						vscode.workspace.workspaceFolders?.length || 0,
						0,
						{ uri: projectUri }
					);
				}
			}
		})
	);

	async function detectProjects(ignoreBlacklist: boolean) {
		const workspace = vscode.workspace.workspaceFolders?.[0];
		if (!workspace) return;

		const workspaceRoot = workspace.uri;
		const { projects: oldProjects, blacklist: oldBlacklist, whitelist } = loadConfig();
		let projects: ProjectConfig[] = [];
		let blacklist = oldBlacklist || [];

		const packageJsonFiles = await vscode.workspace.findFiles('**/package.json', '**/node_modules/**');
		const PM_PRIORITY = ['npm', 'yarn', 'bun', 'pnpm'];

		for (const file of packageJsonFiles) {
			const projectDir = path.dirname(file.fsPath);
			const relativePath = path.relative(workspaceRoot.fsPath, projectDir);

			if (!ignoreBlacklist && blacklist.includes(relativePath) && !whitelist.includes(relativePath)) continue;

			try {
				const raw = await vscode.workspace.fs.readFile(file);
				const pkg = JSON.parse(raw.toString());
				const scripts = Object.keys(pkg.scripts || {});
				if (scripts.length === 0) continue;

				const existingProject = oldProjects.find(p => p.path === relativePath && p.type === 'nodejs');
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
					type: 'nodejs',
					detectedPM,
					manual: false
				});
			} catch { }
		}

		const dockerComposeFiles = await vscode.workspace.findFiles('**/docker-compose*.{yml,yaml}', '**/node_modules/**');

		const dockerProjectsMap = new Map<string, string[]>();
		for (const file of dockerComposeFiles) {
			const projectDir = path.dirname(file.fsPath);
			const relativePath = path.relative(workspaceRoot.fsPath, projectDir);
			const fileName = path.basename(file.fsPath);

			if (!dockerProjectsMap.has(relativePath)) {
				dockerProjectsMap.set(relativePath, []);
			}
			dockerProjectsMap.get(relativePath)!.push(fileName);
		}

		for (const [relativePath, composeFiles] of dockerProjectsMap) {
			if (!ignoreBlacklist && blacklist.includes(relativePath) && !whitelist.includes(relativePath)) continue;

			try {
				const existingProject = oldProjects.find(p => p.path === relativePath && p.type === 'docker');
				if (existingProject?.manual) {
					projects.push(existingProject);
					continue;
				}

				const projectDir = path.join(workspaceRoot.fsPath, relativePath);

				const baseCommands = ['up', 'up -d', 'down', 'ps', 'logs', 'restart', 'stop', 'start', 'build', 'pull'];

				const dockerComposeFilesList: DockerComposeFile[] = [];

				for (const composeFile of composeFiles.sort()) {
					let fileLabel = composeFile
						.replace('docker-compose', '')
						.replace('.yml', '')
						.replace('.yaml', '')
						.replace(/^[-.]/, '')
						.replace(/[-.]$/, '');

					if (!fileLabel) {
						fileLabel = 'default';
					}

					dockerComposeFilesList.push({
						file: composeFile,
						label: fileLabel,
						commands: baseCommands
					});
				}

				let projectName = path.basename(projectDir);
				if (relativePath && relativePath !== '.') {
					const pathParts = relativePath.split(path.sep);
					if (pathParts.length > 1) {
						projectName = pathParts.slice(-2).join('/');
					} else {
						projectName = relativePath;
					}
				}

				projects.push({
					name: projectName,
					path: relativePath,
					scripts: [],
					type: 'docker',
					dockerComposeFiles: dockerComposeFilesList,
					manual: false
				});
			} catch { }
		}

		if (projects.length === 0) {
			vscode.window.showInformationMessage('No projects found in workspace.');
			return;
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
	private currentConfigPath: string = '';

	constructor(private context: vscode.ExtensionContext) { }

	refresh() {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
		return element;
	}

	getAllProjects(): ProjectConfig[] {
		return this.projects;
	}

	async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
		if (!element) {
			const config = vscode.workspace.getConfiguration('cproject-local');
			let customPath = config.get<string>('configPath', '').trim();

			let configPath = '';
			if (customPath) {
				if (customPath.startsWith('~')) {
					customPath = path.join(os.homedir(), customPath.slice(1));
				}
				configPath = path.join(customPath, '.cproject.json');
			} else {
				const workspace = vscode.workspace.workspaceFolders?.[0];
				if (workspace) {
					configPath = vscode.Uri.joinPath(workspace.uri, '.cproject.json').fsPath;
				}
			}
			this.currentConfigPath = configPath || 'No workspace opened';

			if (configPath && fs.existsSync(configPath)) {
				try {
					const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
					this.projects = configData.projects || [];
				} catch {
					this.projects = [];
				}
			} else {
				this.projects = [];
			}

			const items: vscode.TreeItem[] = [];

			items.push(this.createConfigInfoItem());


			const nodejsProjects = this.projects.filter(p => p.type === 'nodejs');
			const dockerProjects = this.projects.filter(p => p.type === 'docker');

			if (nodejsProjects.length > 0) {
				items.push(this.createCategoryItem('Node.js', 'nodejs', nodejsProjects.length));
			}

			if (dockerProjects.length > 0) {
				items.push(this.createCategoryItem('Docker', 'docker', dockerProjects.length));
			}

			return items;
		} else if (element.contextValue === 'category') {
			const categoryType = (element as any).categoryType as ProjectType;
			return this.projects
				.filter(p => p.type === categoryType)
				.map(p => this.createProjectItem(p));
		} else if (element.contextValue === 'project') {
			const project = (element as any).project as ProjectConfig;

			if (project.type === 'docker' && project.dockerComposeFiles && project.dockerComposeFiles.length > 0) {
				return project.dockerComposeFiles.map(cf => this.createComposeFileItem(cf, project));
			}

			return project.scripts.map(s => this.createScriptItem(s, project));
		} else if (element.contextValue === 'dockerComposeFile') {
			const composeFileData = (element as any).composeFile as DockerComposeFile;
			const project = (element as any).project as ProjectConfig;
			return composeFileData.commands.map(cmd => this.createScriptItem(cmd, project, composeFileData));
		}

		return [];
	}

	private createConfigInfoItem(): vscode.TreeItem {
		const workspace = vscode.workspace.workspaceFolders?.[0];
		let displayPath = this.currentConfigPath;

		if (workspace && this.currentConfigPath.startsWith(workspace.uri.fsPath)) {
			displayPath = path.relative(workspace.uri.fsPath, this.currentConfigPath);
			if (displayPath === '.cproject.json') {
				displayPath = 'Workspace Root';
			}
		} else if (this.currentConfigPath.includes(os.homedir())) {
			displayPath = this.currentConfigPath.replace(os.homedir(), '~');
		}

		const item = new vscode.TreeItem(
			`Config Location`,
			vscode.TreeItemCollapsibleState.None
		);
		item.contextValue = 'configInfo';
		item.tooltip = `Config file: ${this.currentConfigPath}\n\nClick to reveal in file explorer`;
		item.description = displayPath;
		item.iconPath = new vscode.ThemeIcon('file-code');

		if (fs.existsSync(this.currentConfigPath)) {
			item.command = {
				command: 'revealFileInOS',
				title: 'Reveal in File Explorer',
				arguments: [vscode.Uri.file(this.currentConfigPath)]
			};
		}

		return item;
	}

	private createCategoryItem(label: string, type: ProjectType, count: number): vscode.TreeItem {
		let runningCount = 0;
		const categoryProjects = this.projects.filter(p => p.type === type);
		for (const project of categoryProjects) {
			for (const key of runningScripts.keys()) {
				if (key.startsWith(`${project.name}:`)) {
					runningCount++;
				}
			}
		}

		const item = new vscode.TreeItem(
			label,
			vscode.TreeItemCollapsibleState.Expanded
		);
		item.contextValue = 'category';
		(item as any).categoryType = type;

		let description = `${count} project${count > 1 ? 's' : ''}`;
		if (runningCount > 0) {
			description += ` • ▶ ${runningCount} running`;
		}
		item.description = description;

		if (type === 'nodejs') {
			item.iconPath = new vscode.ThemeIcon('symbol-namespace', new vscode.ThemeColor('charts.green'));
		} else if (type === 'docker') {
			item.iconPath = new vscode.ThemeIcon('package', new vscode.ThemeColor('charts.blue'));
		}

		return item;
	}

	private createProjectItem(project: ProjectConfig): vscode.TreeItem {
		let runningCount = 0;
		for (const key of runningScripts.keys()) {
			if (key.startsWith(`${project.name}:`)) {
				runningCount++;
			}
		}

		const item = new vscode.TreeItem(project.name, vscode.TreeItemCollapsibleState.Collapsed);
		item.contextValue = 'project';
		(item as any).project = project;
		item.tooltip = project.path;

		if (runningCount > 0) {
			item.description = `▶ ${runningCount} running`;
			item.iconPath = new vscode.ThemeIcon('debug-start', new vscode.ThemeColor('testing.runAction'));
		} else {
			item.iconPath = path.join(this.context.extensionPath, 'resources', 'icons', 'activity.svg');
		}

		return item;
	}

	private createComposeFileItem(composeFile: DockerComposeFile, project: ProjectConfig): vscode.TreeItem {
		let runningCount = 0;
		const keyPrefix = `${project.name}:${composeFile.label}:`;
		for (const key of runningScripts.keys()) {
			if (key.startsWith(keyPrefix)) {
				runningCount++;
			}
		}

		const item = new vscode.TreeItem(
			composeFile.label,
			vscode.TreeItemCollapsibleState.Collapsed
		);
		item.contextValue = 'dockerComposeFile';
		(item as any).composeFile = composeFile;
		(item as any).project = project;

		if (runningCount > 0) {
			item.description = `▶ ${runningCount} running`;
			item.tooltip = `${composeFile.file}\n${runningCount} command(s) running`;
			item.iconPath = new vscode.ThemeIcon('debug-start', new vscode.ThemeColor('testing.runAction'));
		} else {
			item.tooltip = `${composeFile.file}\n${composeFile.commands.length} commands available`;
			item.iconPath = new vscode.ThemeIcon('file-code', new vscode.ThemeColor('charts.blue'));
		}

		return item;
	}

	private createScriptItem(script: string, project: ProjectConfig, composeFile?: DockerComposeFile): vscode.TreeItem {
		let key: string;
		if (composeFile) {
			key = `${project.name}:${composeFile.label}:${script}`;
		} else {
			key = `${project.name}:${script}`;
		}

		const isRunning = runningScripts.has(key);

		let label: string;
		let tooltip: string;

		if (project.type === 'docker') {
			label = script;

			if (composeFile) {
				tooltip = `docker-compose -f ${composeFile.file} ${script}`;
			} else {
				tooltip = `docker-compose ${script}`;
			}
		} else {
			const pm = project.detectedPM || 'npm';
			label = `${script} [${pm}]`;
			tooltip = `${script} (${pm})`;
		}

		const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
		item.contextValue = 'script';
		(item as any).project = project;
		(item as any).script = script;
		(item as any).composeFile = composeFile;
		item.tooltip = tooltip;
		item.iconPath = path.join(
			this.context.extensionPath,
			'resources',
			'icons',
			isRunning ? 'running.svg' : 'stopped.svg'
		);

		item.command = {
			command: isRunning ? 'cproject-local.stopScript' : 'cproject-local.runScript',
			title: isRunning ? 'Stop' : 'Run',
			arguments: [{ script, project, composeFile }]
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
