import type { TokenRingPackage } from "@tokenring-ai/agent";
import packageJSON from "./package.json" with { type: "json" };

export { default as BrowserAgentStateStorage } from "./BrowserAgentStateStorage.ts";

export const packageInfo: TokenRingPackage = {
	name: packageJSON.name,
	version: packageJSON.version,
	description: packageJSON.description,
};
