declare module "react" {
	export type ReactNode = string | number | boolean | null | undefined | ReactElement;

	export interface ReactElement {
		readonly type: string;
	}

	export type JSXElementConstructor<Props> = (props: Props) => ReactElement | null;

	export type PropertiesWithChildren<Props = Record<string, never>> = Props & {
		readonly children?: ReactNode;
	};

	export type PropsWithChildren<Props = Record<string, never>> = Props & {
		readonly children?: ReactNode;
	};
}

type UDim2 = {
	readonly scale: number;
};

declare namespace JSX {
	interface Element {
		readonly type: string;
	}

	interface IntrinsicElements {
		div: {
			readonly children?: import("react").ReactNode;
		};
	}
}
