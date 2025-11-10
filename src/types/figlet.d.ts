declare module 'figlet' {
    export interface Options {
        font?: string;
        horizontalLayout?: string;
        verticalLayout?: string;
        width?: number;
        whitespaceBreak?: boolean;
    }

    export function text(_text: string, _options?: Options | string): string;
    export function text(_text: string, _callback: (_err: Error | null, _data?: string) => void): void;
    export function text(_text: string, _options?: Options | string, _callback?: (_err: Error | null, _data?: string) => void): void;

    export function textSync(_text: string, _options?: Options | string): string;

    export function metadata(_font: string, _callback: (_err: Error | null, _options?: Options, _headerComment?: string) => void): void;

    export function fonts(_callback: (_err: Error | null, _fonts?: string[]) => void): void;
    export function fontsSync(): string[];
}
