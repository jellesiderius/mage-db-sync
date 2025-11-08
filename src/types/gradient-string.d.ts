declare module 'gradient-string' {
    export interface Gradient {
        (text: string): string;
        multiline(text: string): string;
    }

    export const pastel: Gradient;
    export const rainbow: Gradient;
    export const cristal: Gradient;
    export const teen: Gradient;
    export const mind: Gradient;
    export const morning: Gradient;
    export const vice: Gradient;
    export const passion: Gradient;
    export const fruit: Gradient;
    export const instagram: Gradient;
    export const retro: Gradient;
    export const summer: Gradient;
    export const atlas: Gradient;

    function gradient(colors: string[]): Gradient;
    function gradient(...colors: string[]): Gradient;

    export default gradient;
}
