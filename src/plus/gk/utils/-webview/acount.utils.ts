import type { MessageItem, Uri } from 'vscode';
import type { Source } from '../../../../constants.telemetry.js';
import type { Container } from '../../../../container.js';
import type { PlusFeatures } from '../../../../features.js';
import type { DirectiveQuickPickItem } from '../../../../quickpicks/items/directive.js';

export async function ensureAccount(container: Container, title: string, source: Source): Promise<boolean> {
	await Promise.resolve();
	return true;
}

export async function ensureAccountQuickPick(
	container: Container,
	descriptionItem: DirectiveQuickPickItem,
	source: Source,
	silent?: boolean,
): Promise<boolean> {
	await Promise.resolve();
	return true;
}

export async function ensureFeatureAccess(
	container: Container,
	title: string,
	feature: PlusFeatures,
	source: Source,
	repoPath?: string | Uri,
): Promise<boolean> {
	await Promise.resolve();
	return true;
}
