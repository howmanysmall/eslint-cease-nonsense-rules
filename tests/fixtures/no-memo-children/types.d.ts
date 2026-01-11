// React type definitions for testing no-memo-children rule

declare module "@rbxts/react" {
	export type ReactNode = Element | string | number | boolean | null | undefined;

	export interface Element {
		type: unknown;
		props: unknown;
		key: unknown;
	}

	export type ComponentType<Props = object> = (props: Props) => Element | null;
	export type FC<Props = object> = ComponentType<Props>;

	export function memo<Props extends object>(
		Component: ComponentType<Props>,
		propsAreEqual?: (prevProps: Readonly<Props>, nextProps: Readonly<Props>) => boolean,
	): ComponentType<Props>;

	export function createElement(type: unknown, props?: unknown, ...children: Array<unknown>): Element;

	export type PropsWithChildren<Props = unknown> = Props & { children?: ReactNode };
}

declare module "react" {
	export type ReactNode = Element | string | number | boolean | null | undefined;

	export interface Element {
		type: unknown;
		props: unknown;
		key: unknown;
	}

	export type ComponentType<Props = object> = (props: Props) => Element | null;
	export type FC<Props = object> = ComponentType<Props>;

	export function memo<Props extends object>(
		Component: ComponentType<Props>,
		propsAreEqual?: (prevProps: Readonly<Props>, nextProps: Readonly<Props>) => boolean,
	): ComponentType<Props>;

	export function createElement(type: unknown, props?: unknown, ...children: Array<unknown>): Element;

	export type PropsWithChildren<Props = unknown> = Props & { children?: ReactNode };
}
