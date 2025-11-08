declare module 'boxen' {
    export interface Options {
        padding?: number;
        margin?: number | { top?: number; right?: number; bottom?: number; left?: number };
        borderStyle?: 'single' | 'double' | 'round' | 'bold' | 'singleDouble' | 'doubleSingle' | 'classic';
        borderColor?: string;
        backgroundColor?: string;
        title?: string;
        titleAlignment?: 'left' | 'center' | 'right';
    }

    function boxen(text: string, options?: Options): string;
    export default boxen;
}
