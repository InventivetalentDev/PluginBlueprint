declare module "electron-prompt" {
    interface PromptOptions {
        title: string;
        label: string;
        height: number;
        value?: string | null;
        inputAttrs?: {type: string};
    }

    function prompt(options: PromptOptions): Promise<string | null>;
    export = prompt;
}

declare module "electron-progressbar" {
    interface ProgressBarOptions {
        indeterminate: boolean;
        maxValue: number;
        text: string;
        detail: string;
    }

    class ProgressBar {
        constructor(options: ProgressBarOptions);
        value: number;
        detail: string;
        on(event: "ready", callback: () => void): this;
        close(): void;
    }

    export = ProgressBar;
}

declare module "key.pics" {
    export function autoApply(): void;
    export function applyIcon(element: HTMLElement | HTMLElement[] | null): void;
}
