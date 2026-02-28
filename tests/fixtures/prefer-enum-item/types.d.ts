declare global {
	interface EnumItem {
		EnumType: unknown;
		Name: string;
		Value: number;
	}

	namespace Enum {
		namespace ScaleType {
			interface Stretch extends EnumItem {
				EnumType: typeof Enum.ScaleType;
				Name: "Stretch";
				Value: 0;
			}
			const Stretch: Stretch;

			interface Slice extends EnumItem {
				EnumType: typeof Enum.ScaleType;
				Name: "Slice";
				Value: 1;
			}
			const Slice: Slice;

			interface Tile extends EnumItem {
				EnumType: typeof Enum.ScaleType;
				Name: "Tile";
				Value: 2;
			}
			const Tile: Tile;

			interface Fit extends EnumItem {
				EnumType: typeof Enum.ScaleType;
				Name: "Fit";
				Value: 3;
			}
			const Fit: Fit;

			interface Crop extends EnumItem {
				EnumType: typeof Enum.ScaleType;
				Name: "Crop";
				Value: 4;
			}
			const Crop: Crop;
		}
		type ScaleType = ScaleType.Stretch | ScaleType.Slice | ScaleType.Tile | ScaleType.Fit | ScaleType.Crop;

		namespace UIFlexMode {
			interface None extends EnumItem {
				EnumType: typeof Enum.UIFlexMode;
				Name: "None";
				Value: 0;
			}
			const None: None;

			interface Grow extends EnumItem {
				EnumType: typeof Enum.UIFlexMode;
				Name: "Grow";
				Value: 1;
			}
			const Grow: Grow;

			interface Shrink extends EnumItem {
				EnumType: typeof Enum.UIFlexMode;
				Name: "Shrink";
				Value: 2;
			}
			const Shrink: Shrink;

			interface Fill extends EnumItem {
				EnumType: typeof Enum.UIFlexMode;
				Name: "Fill";
				Value: 3;
			}
			const Fill: Fill;

			interface Custom extends EnumItem {
				EnumType: typeof Enum.UIFlexMode;
				Name: "Custom";
				Value: 4;
			}
			const Custom: Custom;
		}
		type UIFlexMode = UIFlexMode.None | UIFlexMode.Grow | UIFlexMode.Shrink | UIFlexMode.Fill | UIFlexMode.Custom;
	}

	type CastsToEnum<TEnum extends EnumItem> = TEnum | TEnum["Name"] | TEnum["Value"];

	interface ImageProps {
		ScaleType?: CastsToEnum<Enum.ScaleType>;
	}

	interface FlexProps {
		FlexMode?: Enum.UIFlexMode | "None" | "Grow" | "Shrink" | "Fill" | "Custom" | number;
	}

	function setScaleType(value: CastsToEnum<Enum.ScaleType>): void;
}

export type { EnumItem };
