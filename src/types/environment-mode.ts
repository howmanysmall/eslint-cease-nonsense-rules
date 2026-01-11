import Typebox from "typebox";

export const isEnvironmentMode = Typebox.Union([Typebox.Literal("roblox-ts"), Typebox.Literal("standard")]);
export type EnvironmentMode = Typebox.Static<typeof isEnvironmentMode>;
