import type { MessageItem, Uri } from 'vscode';
import { window } from 'vscode';
import { proTrialLengthInDays } from '../../../../constants.subscription.js';
import type { Source } from '../../../../constants.telemetry.js';
import type { Container } from '../../../../container.js';
import type { PlusFeatures } from '../../../../features.js';
import { isAdvancedFeature } from '../../../../features.js';
import { createQuickPickSeparator } from '../../../../quickpicks/items/common.js';
import type { DirectiveQuickPickItem } from '../../../../quickpicks/items/directive.js';
import { createDirectiveQuickPickItem, Directive } from '../../../../quickpicks/items/directive.js';

// eslint-disable-next-line @typescript-eslint/require-await
export async function ensureAccount(container: Container, title: string, source: Source): Promise<boolean> {
	return true;
}

// eslint-disable-next-line @typescript-eslint/require-await
export async function ensureAccountQuickPick(
	container: Container,
	descriptionItem: DirectiveQuickPickItem,
	source: Source,
	silent?: boolean,
): Promise<boolean> {
	return true;
}

// eslint-disable-next-line @typescript-eslint/require-await
export async function ensureFeatureAccess(
	container: Container,
	title: string,
	feature: PlusFeatures,
	source: Source,
	repoPath?: string | Uri,
): Promise<boolean> {
	return true;
}
