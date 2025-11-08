declare module 'figlet' {
    export interface Options {
        font?: string;
        horizontalLayout?: 'default' | 'full' | 'fitted' | 'controlled smushing' | 'universal smushing';
        verticalLayout?: 'default' | 'full' | 'fitted' | 'controlled smushing' | 'universal smushing';
        width?: number;
        whitespaceBreak?: boolean;
    }

    export function textSync(text: string, options?: Options): string;
    export function text(text: string, callback: (err: Error | null, data?: string) => void): void;
    export function text(text: string, options: Options, callback: (err: Error | null, data?: string) => void): void;
}
