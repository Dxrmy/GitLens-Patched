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
replaceInFile(path.join(rootDir, 'src/plus/gk/utils/subscription.utils.ts'), [
    {
        description: 'Force computeSubscriptionState to Paid',
        search: `export function computeSubscriptionState(subscription: Optional<Subscription, 'state'>): SubscriptionState {
	return subscription?.state ?? SubscriptionState.Community;
}`,
        replace: `export function computeSubscriptionStateOriginal(subscription: Optional<Subscription, 'state'>): SubscriptionState {
	return subscription?.state ?? SubscriptionState.Community;
}

export function computeSubscriptionState(subscription: Optional<Subscription, 'state'>): SubscriptionState {
	return SubscriptionState.Paid;
}`
    },
    {
        description: 'Force isSubscriptionPaidPlan to true',
        search: `export function isSubscriptionPaidPlan(id: SubscriptionPlanIds): id is PaidSubscriptionPlanIds {
	return orderedPaidPlans.includes(id as PaidSubscriptionPlanIds);
}`,
        replace: `export function isSubscriptionPaidPlan(id: SubscriptionPlanIds): id is PaidSubscriptionPlanIds {
	return true;
}`
    },
    {
        description: 'Update getCommunitySubscription to return Enterprise',
        search: `		account: {
			id: 'free-enterprise-user',
			name: 'Free Enterprise',
			email: 'unlocked@example.com',
			verified: true,`,
        replace: `		account: {
			id: 'free-enterprise-user',
			name: 'VibeCracker Enterprise',
			email: 'unlocked@vibecracker.com',
			verified: true,`
    }
]);

// 2. Patch src/plus/gk/subscriptionService.ts
replaceInFile(path.join(rootDir, 'src/plus/gk/subscriptionService.ts'), [
    {
        description: 'Force Enterprise plan in changeSubscription',
        search: `		if (subscription?.account == null || subscription.account.id === 'free-enterprise-user') {
			subscription = getCommunitySubscription(undefined);
		} else {
			// Keep the real account, but upgrade the plan to Enterprise
			(subscription as Mutable<Subscription>).plan = {
				actual: getSubscriptionPlan('enterprise', false, 0, undefined),
				effective: getSubscriptionPlan('enterprise', false, 0, undefined),
			};
			subscription.state = SubscriptionState.Paid;
		}`,
        replace: `        // [ANTIGRAVITY] FORCE ENTERPRISE
		if (subscription?.account == null || subscription.account.id === 'free-enterprise-user') {
			subscription = getCommunitySubscription(undefined);
		} else {
			// Keep the real account, but upgrade the plan to Enterprise
			(subscription as Mutable<Subscription>).plan = {
				actual: getSubscriptionPlan('enterprise', false, 0, undefined),
				effective: getSubscriptionPlan('enterprise', false, 0, undefined),
			};
			subscription.state = SubscriptionState.Paid;
		}`
    }
]);


// 3. Patch src/env/node/fetch.ts
replaceInFile(path.join(rootDir, 'src/env/node/fetch.ts'), [
    {
        description: 'Export Response/Headers values',
        search: `import fetch from 'node-fetch';`,
        replace: `import fetch, { Headers, Request, Response } from 'node-fetch';`
    },
    {
        description: 'Export Response/Headers values (export)',
        search: `export { fetch };`,
        replace: `export { fetch, Headers, Request, Response };`
    },
    {
        description: 'Remove Response from type export',
        search: `export type { BodyInit, HeadersInit, RequestInfo, RequestInit, Response } from 'node-fetch';`,
        replace: `export type { BodyInit, HeadersInit, RequestInfo, RequestInit, Response } from 'node-fetch';`
    },
    {
        description: 'Restore Response to type export (if missing)',
        search: `export type { BodyInit, HeadersInit, RequestInfo, RequestInit } from 'node-fetch';`,
        replace: `export type { BodyInit, HeadersInit, RequestInfo, RequestInit, Response } from 'node-fetch';`
    }
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
export type Request = globalThis.Request;`
    },
    {
        description: 'Remove Response from type export (fix duplicate)',
        search: `	_Response as Response,`,
        replace: ``
    }
]);

// 5. Patch src/plus/gk/serverConnection.ts
const serverConnPath = path.join(rootDir, 'src/plus/gk/serverConnection.ts');
let serverConnContent = fs.readFileSync(serverConnPath, 'utf8');

if (!serverConnContent.includes('// [ANTIGRAVITY] Mock interception')) {
    // Imports
    serverConnContent = serverConnContent.replace(
        `import { fetch as _fetch, getProxyAgent } from '@env/fetch.js';`,
        `import { Headers as FetchHeaders, Response, fetch as _fetch, getProxyAgent } from '@env/fetch.js';`
    ).replace(
        `import type { RequestInfo, RequestInit, Response } from '@env/fetch.js';`, // Note: Response might be missing here if type import changed
        `import type { RequestInfo, RequestInit, Response } from '@env/fetch.js';`
    );

    // Replace Promise<Response> with Promise<FetchResponse>
    // serverConnContent = serverConnContent.replaceAll(': Promise<Response>', ': Promise<FetchResponse>');

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

                return new FetchResponse(JSON.stringify(mockResponse), {
                    status: 200,
                    statusText: 'OK',
                    headers: new FetchHeaders({ 'Content-Type': 'application/json' })
                });
            }

            if (typeof url === 'string' && (url.includes('user/reactivate-trial'))) {
                 return new FetchResponse(JSON.stringify({}), {
                    status: 200,
                    statusText: 'OK'
                });
            }`;

    if (serverConnContent.includes(injectionPoint)) {
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
const filesToDelete = [
    'CODE_OF_CONDUCT.md',
    'CONTRIBUTING.md',
    'LICENSE.plus',
    'BACKERS.md'
];

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

console.log("Patching complete.");
