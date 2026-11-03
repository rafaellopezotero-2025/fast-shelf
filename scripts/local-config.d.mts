export function readEnv(file: string): Record<string, string>;
export function validateLocalUrl(value: string | undefined, name: string): string;
export function prepareLocalConfig(root: string): { api: string; site: string };
export function readOfflineBuildEnv(root: string): Record<string, string>;