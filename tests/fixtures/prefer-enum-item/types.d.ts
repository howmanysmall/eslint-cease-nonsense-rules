declare global {
	interface EnumItem {
		Name: string;
		Value: number;
		EnumType: unknown;
	}

	namespace Enum {
		namespace ScaleType {
			interface Stretch extends EnumItem {
				Name: "Stretch";
				Value: 0;
				EnumType: typeof Enum.ScaleType;
			}
			const Stretch: Stretch;

			interface Slice extends EnumItem {
				Name: "Slice";
				Value: 1;
				EnumType: typeof Enum.ScaleType;
			}
			const Slice: Slice;

			interface Tile extends EnumItem {
				Name: "Tile";
				Value: 2;
				EnumType: typeof Enum.ScaleType;
			}
			const Tile: Tile;

			interface Fit extends EnumItem {
				Name: "Fit";
				Value: 3;
				EnumType: typeof Enum.ScaleType;
			}
			const Fit: Fit;

			interface Crop extends EnumItem {
				Name: "Crop";
				Value: 4;
				EnumType: typeof Enum.ScaleType;
			}
			const Crop: Crop;
		}
		type ScaleType = ScaleType.Stretch | ScaleType.Slice | ScaleType.Tile | ScaleType.Fit | ScaleType.Crop;

		namespace UIFlexMode {
			interface None extends EnumItem {
				Name: "None";
				Value: 0;
				EnumType: typeof Enum.UIFlexMode;
			}
			const None: None;

			interface Grow extends EnumItem {
				Name: "Grow";
				Value: 1;
				EnumType: typeof Enum.UIFlexMode;
			}
			const Grow: Grow;

			interface Shrink extends EnumItem {
				Name: "Shrink";
				Value: 2;
				EnumType: typeof Enum.UIFlexMode;
			}
			const Shrink: Shrink;

			interface Fill extends EnumItem {
				Name: "Fill";
				Value: 3;
				EnumType: typeof Enum.UIFlexMode;
			}
			const Fill: Fill;

			interface Custom extends EnumItem {
				Name: "Custom";
				Value: 4;
				EnumType: typeof Enum.UIFlexMode;
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
