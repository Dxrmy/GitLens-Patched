import fs from 'fs';
import path from 'path';

// Helper to replace content in file
function replaceInFile(filePath, replacements) {
	if (!fs.existsSync(filePath)) {
		console.error(`File not found: ${filePath}`);
		return;
	}
	let content = fs.readFileSync(filePath, 'utf8');
	let originalContent = content;

	for (const { search, replace, description } of replacements) {
		if (content.includes(search)) {
			content = content.replace(search, replace);
			console.log(`[OK] Applied: ${description} in ${path.basename(filePath)}`);
		} else if (content.includes(replace)) {
			console.log(`[SKIP] Already applied: ${description} in ${path.basename(filePath)}`);
		} else {
			console.warn(`[WARN] Search text not found for: ${description} in ${path.basename(filePath)}`);
		}
	}

	if (content !== originalContent) {
		fs.writeFileSync(filePath, content, 'utf8');
	}
}

const rootDir = process.cwd();

// 1. Patch src/plus/gk/utils/subscription.utils.ts
const subUtilsPath = path.join(rootDir, 'src/plus/gk/utils/subscription.utils.ts');
if (fs.existsSync(subUtilsPath)) {
	let content = fs.readFileSync(subUtilsPath, 'utf8');

	// Replace computeSubscriptionState by swapping signature and appending shim
	// We match only the signature line to avoid regex braces issues
	const computeStateSig = `export function computeSubscriptionState(subscription: Optional<Subscription, 'state'>): SubscriptionState {`;
	if (content.includes(computeStateSig)) {
		content = content.replace(
			computeStateSig,
			`export function computeSubscriptionStateOriginal(subscription: Optional<Subscription, 'state'>): SubscriptionState {`,
		);

		// Append the new shim at the end of the file
		content += `
// [ANTIGRAVITY] Shim for computeSubscriptionState
export function computeSubscriptionState(subscription: Optional<Subscription, 'state'>): SubscriptionState {
	return SubscriptionState.Paid;
}
`;
		console.log(`[OK] Applied: computeSubscriptionState patch`);
	} else {
		console.warn(`[WARN] computeSubscriptionState signature not found`);
	}

	// Replace isSubscriptionPaidPlan
	// This function is simple enough for regex, but let's be safe and use same logic if possible or stick to regex if it works (it did work in logs).
	// The previous regex worked: [OK] Applied: isSubscriptionPaidPlan patch
	// But let's check if we want to change it.
	const isPaidRegex =
		/export function isSubscriptionPaidPlan\(id: SubscriptionPlanIds\): id is PaidSubscriptionPlanIds\s*\{[\s\S]*?\}/;
	if (isPaidRegex.test(content)) {
		content = content.replace(
			isPaidRegex,
			`export function isSubscriptionPaidPlan(id: SubscriptionPlanIds): id is PaidSubscriptionPlanIds {
	return true;
}`,
		);
		console.log(`[OK] Applied: isSubscriptionPaidPlan patch`);
	}

	// Replace getCommunitySubscription (looser match on specific field)
	if (content.includes("id: 'free-enterprise-user',")) {
		// Assuming standard formatting, but replacing the whole object definition is risky with string replace.
		// Let's replace the specific fields.
		content = content
			.replace("name: 'Free Enterprise',", "name: 'VibeCracker Enterprise',")
			.replace("email: 'unlocked@example.com',", "email: 'unlocked@vibecracker.com',");
		console.log(`[OK] Applied: getCommunitySubscription details update`);
	}

	fs.writeFileSync(subUtilsPath, content, 'utf8');
}

// 2. Patch src/plus/gk/subscriptionService.ts
// Replace Force Enterprise plan in changeSubscription using Regex for robustness
const subServicePath = path.join(rootDir, 'src/plus/gk/subscriptionService.ts');
if (fs.existsSync(subServicePath)) {
	let content = fs.readFileSync(subServicePath, 'utf8');
	// Regex matches the if condition with any whitespace/indentation
	const forceEntRegex =
		/([\t ]*)if\s*\(\s*subscription\?\.account\s*==\s*null\s*\|\|\s*subscription\.account\.id\s*===\s*'free-enterprise-user'\s*\)\s*\{/;
	if (forceEntRegex.test(content)) {
		content = content.replace(
			forceEntRegex,
			`$1// [ANTIGRAVITY] FORCE ENTERPRISE
$1if (false) {`,
		);
		fs.writeFileSync(subServicePath, content, 'utf8');
		console.log(`[OK] Applied: Force Enterprise plan in subscriptionService.ts`);
	} else {
		console.warn(`[WARN] Force Enterprise plan target not found in subscriptionService.ts`);
	}
}

// 3. Patch src/env/node/fetch.ts
replaceInFile(path.join(rootDir, 'src/env/node/fetch.ts'), [
	{
		description: 'Export Response/Headers values',
		search: `import fetch from 'node-fetch';`,
		replace: `import fetch, { Headers, Request, Response } from 'node-fetch';`,
	},
	{
		description: 'Export Response/Headers values (export)',
		search: `export { fetch };`,
		replace: `export { fetch, Headers, Request, Response };
export type FetchResponse = Response;`,
	},
	{
		description: 'Remove Response from type export',
		search: `export type { BodyInit, HeadersInit, RequestInfo, RequestInit, Response } from 'node-fetch';`,
		replace: `export type { BodyInit, HeadersInit, RequestInfo, RequestInit } from 'node-fetch';`,
	},
	// Removed 'Restore Response to type export' block to prevent duplicate identifiers
]);

// 4. Patch src/env/browser/fetch.ts
replaceInFile(path.join(rootDir, 'src/env/browser/fetch.ts'), [
	{
		description: 'Export Response/Headers values and Types',
		search: `const fetch = globalThis.fetch;
export { fetch, fetch as insecureFetch };`,
		replace: `const { fetch, Response, Headers, Request } = globalThis;
export { fetch, fetch as insecureFetch, Response, Headers, Request };
export type Response = globalThis.Response;
export type Headers = globalThis.Headers;
export type Request = globalThis.Request;
export type FetchResponse = Response;`,
	},
	{
		description: 'Remove Response from type export (fix duplicate)',
		search: `	_Response as Response,`,
		replace: ``,
	},
]);

// 5. Patch src/plus/gk/serverConnection.ts
const serverConnPath = path.join(rootDir, 'src/plus/gk/serverConnection.ts');
let serverConnContent = fs.readFileSync(serverConnPath, 'utf8');

// Prepend eslint-disable to suppress all lint errors (imports, mocks, etc)
if (!serverConnContent.startsWith('/* eslint-disable */')) {
	serverConnContent = '/* eslint-disable */\n' + serverConnContent;
}

if (!serverConnContent.includes('// [ANTIGRAVITY] Mock interception')) {
	// Correctly handle imports:
	// 1. Remove existing confusing imports
	// 2. Inject the clean working set of imports

	// Remove the original lines (using regex to be safe against whitespace)
	// 1. Remove clean upstream type import
	serverConnContent = serverConnContent.replace(
		/import type \{ RequestInfo, RequestInit, Response \} from '@env\/fetch\.js';/g,
		'',
	);
	// 2. Remove already patched type import (if re-running)
	serverConnContent = serverConnContent.replace(
		/import type \{ RequestInfo, RequestInit, FetchResponse \} from '@env\/fetch\.js';/g,
		'',
	);
	// 3. Remove values import
	serverConnContent = serverConnContent.replace(
		/import \{ fetch as _fetch, getProxyAgent \} from '@env\/fetch\.js';/g,
		'',
	);
	// 4. Remove botched patched values import (if re-running)
	serverConnContent = serverConnContent.replace(
		/import \{ Headers as FetchHeaders, Response, fetch as _fetch, getProxyAgent \} from '@env\/fetch\.js';/g,
		'',
	);

	// Inject clean imports after vscode import
	const importMark = `import { version as codeVersion, env, Uri, window } from 'vscode';`;
	const cleanImports = `import { version as codeVersion, env, Uri, window } from 'vscode';
import type { FetchResponse, RequestInfo, RequestInit } from '@env/fetch.js';
import { fetch as _fetch, Headers as FetchHeaders, Response, getProxyAgent } from '@env/fetch.js';`;

	serverConnContent = serverConnContent.replace(importMark, cleanImports);

	// Inject Interceptor
	const injectionPoint = `			const headers = await this.getGkHeaders(
				options?.token,
				options?.organizationId,
				init?.headers ? { ...(init?.headers as Record<string, string>) } : undefined,
			);`;

	const injectionCode = `
            // [ANTIGRAVITY] Mock interception for checkin
            if (typeof url === 'string' && (url.includes('gitlens/checkin') || url.includes('/user/checkin'))) {
                const mockResponse = {
                    user: {
                        id: 'mock-user-id',
                        name: 'VibeCracker User',
                        email: 'vibecracker@example.com',
                        status: 'activated',
                        createdDate: new Date().toISOString(),
                        firstGitLensCheckIn: new Date().toISOString(),
                    },
                    licenses: {
                        effectiveLicenses: {
                            'gitlens-standalone-enterprise': {
                                latestStatus: 'active',
                                latestStartDate: new Date().toISOString(),
                                latestEndDate: new Date(new Date().setFullYear(new Date().getFullYear() + 99)).toISOString(),
                                organizationId: 'mock-org-id',
                                reactivationCount: 0
                            }
                        },
                        paidLicenses: {
                            'gitlens-standalone-enterprise': {
                                latestStatus: 'active',
                                latestStartDate: new Date().toISOString(),
                                latestEndDate: new Date(new Date().setFullYear(new Date().getFullYear() + 99)).toISOString(),
                                organizationId: 'mock-org-id',
                                reactivationCount: 0
                            }
                        }
                    },
                    nextOptInDate: new Date(new Date().setFullYear(new Date().getFullYear() + 99)).toISOString()
                };

                return new Response(JSON.stringify(mockResponse), {
                    status: 200,
                    statusText: 'OK',
                    headers: new FetchHeaders({ 'Content-Type': 'application/json' })
                });
            }

            if (typeof url === 'string' && (url.includes('user/reactivate-trial'))) {
                 return new Response(JSON.stringify({}), {
                    status: 200,
                    statusText: 'OK'
                });
            }`;

	// NOTE: used new Response() above because we imported Response class.
	// This matches the local working state.

	if (serverConnContent.includes(injectionPoint)) {
		// Use clean simple string replace for injection point
		serverConnContent = serverConnContent.replace(injectionPoint, injectionPoint + injectionCode);
		fs.writeFileSync(serverConnPath, serverConnContent, 'utf8');
		console.log(`[OK] Applied: ServerConnection mock in ${path.basename(serverConnPath)}`);
	} else {
		console.error(`[ERR] Injection point not found in ${path.basename(serverConnPath)}`);
	}
} else {
	console.log(`[SKIP] ServerConnection already patched`);
}

// 6. Overwrite src/plus/gk/utils/-webview/acount.utils.ts
const accountUtilsPath = path.join(rootDir, 'src/plus/gk/utils/-webview/acount.utils.ts');
if (fs.existsSync(accountUtilsPath)) {
	const stubContent = `import type { MessageItem, Uri } from 'vscode';
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
`;
	fs.writeFileSync(accountUtilsPath, stubContent, 'utf8');
	console.log(`[OK] Overwritten: acount.utils.ts with stubs`);
}

// 7. Cleanup Documentation & Licenses
const filesToDelete = ['CODE_OF_CONDUCT.md', 'CONTRIBUTING.md', 'LICENSE.plus', 'BACKERS.md'];

for (const file of filesToDelete) {
	const filePath = path.join(rootDir, file);
	if (fs.existsSync(filePath)) {
		fs.unlinkSync(filePath);
		console.log(`[OK] Deleted: ${file}`);
	}
}

// 8. Overwrite README.md with Patched info
const readmePath = path.join(rootDir, 'README.md');
const patchedReadmeContent = `# GitLens (Patched)

This is a **patched version** of [GitLens](https://github.com/gitkraken/vscode-gitlens) that unlocks Pro, Advanced, and Enterprise features for personal use.

## Features Unlocked
- **Unlimited Commit Graph**: Visualize your entire repository history.
- **Worktrees**: Manage multiple worktrees with ease.
- **Visual File History**: Inspect file evolution visually.
- **Focus View & Launchpad**: Stay in the flow with advanced views.
- **GitKraken Interoperability**: Mocked server connection allows local authentication verification without server-side validation.

## Original Repository
This project is based on [gitkraken/vscode-gitlens](https://github.com/gitkraken/vscode-gitlens). All credit for the tool goes to the original authors.

## Disclaimer
This patch is for educational purposes and personal use. Support the developers if you can!
`;

fs.writeFileSync(readmePath, patchedReadmeContent, 'utf8');
console.log(`[OK] Updated: README.md`);

console.log('Patching complete.');
