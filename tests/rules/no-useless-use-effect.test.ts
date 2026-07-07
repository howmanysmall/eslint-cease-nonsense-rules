import { describe } from "vitest";
import rule from "$rules/no-useless-use-effect";
import parser from "@typescript-eslint/parser";
import { RuleTester } from "@typescript-eslint/rule-tester";

const ruleTester = new RuleTester({
	languageOptions: {
		ecmaVersion: 2022,
		parser,
		sourceType: "module",
	},
});

describe("no-useless-use-effect", () => {
	ruleTester.run("no-useless-use-effect", rule, {
		invalid: [
			{
				code: `
import { "useEffect" as useEffectAlias, useState } from "@rbxts/react";

function Component(properties) {
    const [count, setCount] = useState(0);
    useEffectAlias(() => {
        setCount(properties.initialCount);
    }, [properties.initialCount]);
}
`,
				errors: [{ messageId: "derivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component(properties) {
    const [fullName, setFullName] = useState("");
    useEffect(() => {
        setFullName(properties.firstName + properties.lastName);
    }, [properties.firstName, properties.lastName]);
}
`,
				errors: [{ messageId: "derivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ values, keyName }) {
    const [value, setValue] = useState("");
    useEffect(() => {
        setValue(values[keyName]);
    }, [values, keyName]);
}
`,
				errors: [{ messageId: "derivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ values, pick }) {
    const [value, setValue] = useState("");
    useEffect(() => {
        setValue(pick(...values));
    }, [values, pick]);
}
`,
				errors: [{ messageId: "derivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ value, items }) {
    const [nextItems, setNextItems] = useState<string[]>([]);
    useEffect(() => {
        setNextItems([value, ...items]);
    }, [value, items]);
}
`,
				errors: [{ messageId: "derivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ value, rest }) {
    const [nextValue, setNextValue] = useState({});
    useEffect(() => {
        setNextValue({ value, ...rest });
    }, [value, rest]);
}
`,
				errors: [{ messageId: "derivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [value, setValue] = useState(0);
    useEffect(() => {
        setValue(value + 1);
    }, []);
}
`,
				errors: [{ messageId: "derivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component(properties) {
    const [label, setLabel] = useState("");
    useEffect(() => {
        setLabel(\`\${properties.firstName} \${properties.lastName}\`);
    }, [properties.firstName, properties.lastName]);
}
`,
				errors: [{ messageId: "derivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component(properties) {
    const [name, setName] = useState("");
    useEffect(() => {
        setName(properties.user?.name);
    }, [properties.user]);
}
`,
				errors: [{ messageId: "derivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component(properties) {
    const [selection, setSelection] = useState("");
    useEffect(() => {
        if (!properties.initialSelection) return;
        setSelection(properties.initialSelection);
    }, [properties.initialSelection]);
}
`,
				errors: [{ messageId: "derivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component(properties) {
    const [count, setCount] = useState(0);
    useEffect(() => {
        if (properties.ready) setCount(properties.value);
    }, [properties.ready, properties.value]);
}
`,
				errors: [{ messageId: "derivedState" }],
			},
			{
				code: `
import { useEffect, useReducer } from "@rbxts/react";

function reducer(state, action) {
    return action.type === "set" ? action.value : state;
}

function Component(properties) {
    const [value, dispatch] = useReducer(reducer, 0);
    useEffect(() => {
        if (properties.ready) {
            dispatch({ type: "set", value: properties.value });
        }
    }, [properties.ready, properties.value]);
}
`,
				errors: [{ messageId: "derivedState" }],
			},
			{
				code: `
import { useLayoutEffect, useState } from "react";

function Component(properties) {
    const [count, setCount] = useState(0);
    useLayoutEffect(() => {
        setCount(properties.initialCount);
    }, [properties.initialCount]);
}
`,
				errors: [{ messageId: "derivedState" }],
				options: [{ environment: "standard" }],
			},

			// NotifyParent - existing
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ onChange, value }) {
    useEffect(() => {
        onChange(value);
    }, [onChange, value]);
}
`,
				errors: [{ messageId: "notifyParent" }],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component(properties) {
    useEffect(() => {
        properties.onChange?.(properties.value);
    }, [properties.value, properties.onChange]);
}
`,
				errors: [{ messageId: "notifyParent" }],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ "onChange": handleChange = fallbackChange, value }) {
    useEffect(() => {
        handleChange(value);
    }, [handleChange, value]);
}
`,
				errors: [{ messageId: "notifyParent" }],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ onChange, value }) {
    useEffect(() => {
        if (value) onChange(value);
    }, [onChange, value]);
}
`,
				errors: [{ messageId: "notifyParent" }],
			},
			{
				code: `
import React from "@rbxts/react";

function Component(properties) {
    React.useEffect(() => {
        properties.onChange(properties.value);
    }, [properties.value, properties.onChange]);
}
`,
				errors: [{ messageId: "notifyParent" }],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component(properties = {}) {
    useEffect(() => {
        properties.onChange(properties.value);
    }, [properties.value, properties.onChange]);
}
`,
				errors: [{ messageId: "notifyParent" }],
			},
			{
				code: `
import { useInsertionEffect } from "@rbxts/react";

function Component({ onMount }) {
    useInsertionEffect(() => {
        onMount();
    }, [onMount]);
}
`,
				errors: [{ messageId: "notifyParent" }],
			},

			// EventFlag - existing
			{
				code: `
import * as React from "@rbxts/react";

function Component() {
    const [submitted, setSubmitted] = React.useState(false);
    React.useEffect(() => {
        if (!submitted) return;
        sendForm();
        setSubmitted(false);
    }, [submitted]);
}
`,
				errors: [{ messageId: "eventFlag" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [submitted, setSubmitted] = useState(false);
    useEffect(() => {
        if (submitted) {
            setSubmitted(false);
            sendForm();
        }
    }, [submitted]);
}
`,
				errors: [{ messageId: "eventFlag" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [submitted, setSubmitted] = useState(false);
    useEffect(() => {
        if (submitted) {
            sendForm();
            setSubmitted(false);
        }
    }, [submitted]);
}
`,
				errors: [{ messageId: "eventFlag" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [submitted, setSubmitted] = useState(false);
    useEffect(() => {
        if (!submitted) {
            return;
        }
        setSubmitted(false);
        sendForm();
    }, [submitted]);
}
`,
				errors: [{ messageId: "eventFlag" }],
			},

			// ========== NEW: NAMED FUNCTION RESOLUTION ==========

			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component(properties) {
    const [count, setCount] = useState(0);

    function initEffect(): void {
        setCount(properties.initialValue);
    }
    useEffect(initEffect, [properties.initialValue]);
}
`,
				errors: [{ messageId: "derivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component(properties) {
    const [count, setCount] = useState(0);

    const initEffect = () => {
        setCount(properties.initialValue);
    };
    useEffect(initEffect, [properties.initialValue]);
}
`,
				errors: [{ messageId: "derivedState" }],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ onChange, value }) {
    function notify() {
        onChange(value);
    }
    useEffect(notify, [onChange, value]);
}
`,
				errors: [{ messageId: "notifyParent" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [submitted, setSubmitted] = useState(false);

    function handleSubmit() {
        if (!submitted) return;
        sendForm();
        setSubmitted(false);
    }
    useEffect(handleSubmit, [submitted]);
}
`,
				errors: [{ messageId: "eventFlag" }],
			},

			// ========== NEW: emptyEffect ==========
			// Note: Empty arrow function bodies like `() => {}` may have subtle parsing
			// Differences. The following tests check for effects with truly empty bodies.

			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(() => {
    }, []);
}
`,
				errors: [{ messageId: "emptyEffect" }],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(() => {
        return;
    }, []);
}
`,
				errors: [{ messageId: "emptyEffect" }],
			},

			// ========== NEW: initializeState ==========

			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [name, setName] = useState<string | undefined>();
    useEffect(() => {
        setName("Hello World");
    }, []);
}
`,
				errors: [{ messageId: "initializeState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [count, setCount] = useState(0);
    useEffect(() => {
        setCount(42);
    }, []);
}
`,
				errors: [{ messageId: "initializeState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [items, setItems] = useState<string[]>([]);
    useEffect(() => {
        setItems([]);
    }, []);
}
`,
				errors: [{ messageId: "initializeState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [enabled, setEnabled] = useState(false);
    useEffect(() => {
        setEnabled(true);
    });
}
`,
				errors: [{ messageId: "initializeState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [, setEnabled] = useState(false);
    useEffect(() => {
        setEnabled(true);
    }, []);
}
`,
				errors: [{ messageId: "initializeState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ ready }) {
    const [enabled, setEnabled] = useState(false);
    useEffect(() => {
        if (ready) {
            setEnabled(true);
        }
    }, []);
}
`,
				errors: [{ messageId: "initializeState" }],
			},

			// ========== NEW: resetState ==========

			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ userId }) {
    const [comment, setComment] = useState("");
    useEffect(() => {
        setComment("");
    }, [userId]);
}
`,
				errors: [{ messageId: "resetState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ userId }) {
    const [settings, setSettings] = useState({});
    useEffect(() => {
        if (userId) {
            setSettings({});
        }
    }, [userId]);
}
`,
				errors: [{ messageId: "resetState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ items }) {
    const [selection, setSelection] = useState<string | null>(null);
    useEffect(() => {
        setSelection(null);
    }, [items]);
}
`,
				errors: [{ messageId: "resetState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ userId }) {
    const [isLoading, setIsLoading] = useState(false);
    useEffect(() => {
        setIsLoading(false);
    }, [userId]);
}
`,
				errors: [{ messageId: "resetState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ userId }) {
    const [items, setItems] = useState<string[]>([]);
    useEffect(() => {
        setItems([]);
    }, [userId]);
}
`,
				errors: [{ messageId: "resetState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ userId }) {
    const [selection, setSelection] = useState<string | undefined>(undefined);
    useEffect(() => {
        setSelection(void 0);
    }, [userId]);
}
`,
				errors: [{ messageId: "resetState" }],
			},

			// ========== NEW: adjustState ==========

			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ items }) {
    const [selection, setSelection] = useState<string | null>(null);
    useEffect(() => {
        if (items.length > 0) {
            setSelection(items[0]);
        }
    }, [items]);
}
`,
				errors: [{ messageId: "adjustState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ user }) {
    const [profile, setProfile] = useState<string | null>(null);
    useEffect(() => {
        if (user) {
            setProfile(user.name);
        } else {
            setProfile(null);
        }
    }, [user]);
}
`,
				errors: [{ messageId: "adjustState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ items }) {
    const [selection, setSelection] = useState<string | null>(null);
    useEffect(() => {
        if (items.length === 0) {
            return;
        } else {
            if (items.length > 1) {
                setSelection(items[0]);
            }
        }
    }, [items]);
}
`,
				errors: [{ messageId: "adjustState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ ready, value }) {
    const [selection, setSelection] = useState("");
    useEffect(() => {
        if (!ready) {
            return;
        } else {
            if (ready) {
                setSelection(value);
            }
        }
    }, [ready, value]);
}
`,
				errors: [{ messageId: "adjustState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ ready, value }) {
    const [selection, setSelection] = useState("");
    useEffect(() => {
        if (!ready) {
            return;
        } else if (ready) {
            setSelection(value);
        }
    }, [ready, value]);
}
`,
				errors: [{ messageId: "adjustState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ properties, statusKey, value }) {
    const [selection, setSelection] = useState("");
    useEffect(() => {
        if (properties[statusKey]) {
            setSelection(value);
        }
    }, [properties, statusKey, value]);
}
`,
				errors: [{ messageId: "adjustState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ flags, ready, value }) {
    const [selection, setSelection] = useState("");
    useEffect(() => {
        if (ready(...flags)) {
            setSelection(value);
        }
    }, [flags, ready, value]);
}
`,
				errors: [{ messageId: "adjustState" }],
			},

			// ========== NEW: eventSpecificLogic ==========
			// Note: This detection is intentionally conservative to avoid false positives
			// On legitimate synchronization patterns like "fetch data, then process it"
			// The eventFlag pattern handles the common "toggle flag -> run side effect" case

			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [submitted, setSubmitted] = useState(false);
    useEffect(() => {
        if (submitted) {
            notifySubmit();
        }
    }, [submitted]);
}
`,
				errors: [{ messageId: "eventSpecificLogic" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ analytics }) {
    const [submitted, setSubmitted] = useState(false);
    useEffect(() => {
        if (submitted) {
            analytics.trackSubmit();
        }
    }, [submitted, analytics]);
}
`,
				errors: [{ messageId: "eventSpecificLogic" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ blocked }) {
    const [submitted, setSubmitted] = useState(false);
    useEffect(() => {
        if (isReady(submitted) && (!blocked ? submitted : false)) {
            reporter.trackSubmit(submitted);
        }
    }, [submitted, blocked, reporter]);
}
`,
				errors: [{ messageId: "eventSpecificLogic" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ ready }) {
    const [submitted, setSubmitted] = useState(false);
    useEffect(() => {
        if (ready) {
            return;
        } else {
            if (submitted?.ready) {
                notifySubmit();
            }
        }
    }, [ready, submitted]);
}
`,
				errors: [{ messageId: "eventSpecificLogic" }],
			},

			// ========== NEW: mixedDerivedState ==========

			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ count, logger }) {
    const [localCount, setLocalCount] = useState(0);
    useEffect(() => {
        setLocalCount(count);
        logger.log(count);
    }, [count, logger]);
}
`,
				errors: [{ messageId: "mixedDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ onChange, value }) {
    const [localValue, setLocalValue] = useState(0);
    useEffect(() => {
        setLocalValue(value);
        onChange(value);
        formatValue(value);
    }, [onChange, value]);
}
`,
				errors: [{ messageId: "mixedDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ onApi, value }) {
    const [localValue, setLocalValue] = useState(0);
    useEffect(() => {
        setLocalValue(value);
        onApi.send(value);
        formatValue(value);
    }, [onApi, value]);
}
`,
				errors: [{ messageId: "mixedDerivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component(properties) {
    const [summary, setSummary] = useState({});
    useEffect(() => {
        setSummary({
            label: \`\${properties.firstName} \${properties.lastName}\`,
            visible: properties.enabled ? properties.primary : properties.secondary,
            values: [properties.count],
        });
    }, [properties.firstName, properties.lastName, properties.enabled, properties.primary, properties.secondary, properties.count]);
}
`,
				errors: [{ messageId: "derivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component(properties) {
    const [summary, setSummary] = useState("");
    useEffect(() => {
        setSummary(format((properties.enabled && properties.name) ? properties.name : properties.fallback));
    }, [properties.enabled, properties.name, properties.fallback]);
}
`,
				errors: [{ messageId: "derivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component(properties) {
    const [enabled, setEnabled] = useState(false);
    useEffect(() => {
        setEnabled(!properties.disabled);
    }, [properties.disabled]);
}
`,
				errors: [{ messageId: "derivedState" }],
			},

			// ========== NEW: passRefToParent ==========

			{
				code: `
import { useEffect, useRef } from "@rbxts/react";

function Component({ onRef }) {
    const myRef = useRef();
    useEffect(() => {
        onRef(myRef.current);
    }, [onRef, myRef]);
}
`,
				errors: [{ messageId: "passRefToParent" }],
			},
			{
				code: `
import { useEffect, useRef } from "@rbxts/react";

function Component({ onReady }) {
    const containerRef = useRef();
    useEffect(() => {
        if (containerRef.current) {
            onReady(containerRef.current);
        }
    }, [onReady, containerRef]);
}
`,
				errors: [{ messageId: "passRefToParent" }],
			},

			// ========== NEW: externalStore ==========

			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);
        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);
}
`,
				errors: [{ messageId: "externalStore" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [width, setWidth] = useState(window.innerWidth);
    useEffect(() => {
        const handleResize = () => setWidth(window.innerWidth);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);
}
`,
				errors: [{ messageId: "externalStore" }],
			},

			// ========== NEW: logOnly ==========

			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ value }) {
    useEffect(() => {
        console.log("Value changed:", value);
    }, [value]);
}
`,
				errors: [{ messageId: "logOnly" }],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(() => {
        console.log("Component mounted");
    }, []);
}
`,
				errors: [{ messageId: "logOnly" }],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

useEffect(() => {
    console.log("mounted");
}, []);
`,
				errors: [{ messageId: "logOnly" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

const [value, setValue] = useState(0);

useEffect(() => {
    setValue(value + 1);
    recalculate();
}, [value]);
`,
				errors: [{ messageId: "mixedDerivedState" }],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ count }) {
    useEffect(() => {
        console.log("Count:", count);
        console.warn("Warning message");
    }, [count]);
}
`,
				errors: [{ messageId: "logOnly" }],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ count }) {
    useEffect(() => {
        if (count > 0) {
            console.log("Count:", count);
        }
    }, [count]);
}
`,
				errors: [{ messageId: "logOnly" }],
			},

			// ========== NEW: duplicateDeps ==========

			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ userId }) {
    useEffect(() => {
        fetchUser(userId);
    }, [userId]);

    useEffect(() => {
        getProfilePicture(userId);
    }, [userId]);
}
`,
				errors: [{ messageId: "duplicateDeps" }, { messageId: "duplicateDeps" }],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ count }) {
    useEffect(() => {
        logCount(count);
    }, [count]);

    useEffect(() => {
        sendAnalytics(count);
    }, [count]);

    useEffect(() => {
        updateTitle(count);
    }, [count]);
}
`,
				errors: [
					{ messageId: "duplicateDeps" },
					{ messageId: "duplicateDeps" },
					{ messageId: "duplicateDeps" },
				],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ userId, count }) {
    useEffect(() => {
        fetchUser(userId);
    }, [userId]);

    useEffect(() => {
        fetchPermissions(userId);
    }, [userId]);

    useEffect(() => {
        logCount(count);
    }, [count]);

    useEffect(() => {
        fetchProfile(userId);
    }, [userId]);
}
`,
				errors: [
					{ messageId: "duplicateDeps" },
					{ messageId: "duplicateDeps" },
					{ messageId: "duplicateDeps" },
				],
			},

			// ========== NEW: effectChain ==========
			// Note: EffectChain detection identifies chains of effects where one effect
			// Sets state that triggers another effect. The individual effects in the chain
			// May not trigger derivedState if they use callback form setters or set constants.

			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [card, setCard] = useState(null);
    const [goldCardCount, setGoldCardCount] = useState(0);

    useEffect(() => {
        if (card !== null && card.gold) {
            setGoldCardCount(c => c + 1);
        }
    }, [card]);

    useEffect(() => {
        if (goldCardCount > 3) {
            setCard(null);
        }
    }, [goldCardCount]);
}
`,
				// Only effectChain, not derivedState for individual effects
				errors: [{ messageId: "effectChain" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [value, setValue] = useState(0);
    const [doubled, setDoubled] = useState(0);

    useEffect(() => {
        setDoubled(value * 2);
    }, [value]);

    useEffect(() => {
        setValue(doubled + 1);
    }, [doubled]);
}
`,
				errors: [{ messageId: "derivedState" }, { messageId: "effectChain" }, { messageId: "derivedState" }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [value, setValue] = useState(0);
    const [mirror, setMirror] = useState(0);

    useEffect(() => {
        setValue(mirror + 1);
    }, [mirror]);

    useEffect(() => {
        setValue(mirror + 2);
    }, [mirror]);

    useEffect(() => {
        setMirror(value + 1);
    }, [value]);
}
`,
				errors: [
					{ messageId: "derivedState" },
					{ messageId: "effectChain" },
					{ messageId: "duplicateDeps" },
					{ messageId: "derivedState" },
					{ messageId: "duplicateDeps" },
					{ messageId: "derivedState" },
				],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [submitted, setSubmitted] = useState(false);
    useEffect(() => {
        if (submitted) {
            setSubmitted(false);
        } else if (!submitted) {
            trackSubmit();
        }
    }, [submitted]);
}
`,
				errors: [{ messageId: "eventSpecificLogic" }, { messageId: "effectChain" }],
			},
		],
		valid: [
			// ========== EXISTING VALID TESTS ==========

			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect();
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ onReady }) {
    useEffect(onReady, [onReady]);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component(properties) {
    useEffect(() => {
        properties["onChange"](properties.value);
    }, [properties]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [submitted, setSubmitted] = useState(false);
    useEffect(() => {
        if (submitted) {
            const nextSubmitted = false;
            setSubmitted(nextSubmitted);
        }
    }, [submitted]);
}
`,
				options: [{ reportDerivedState: false, reportEffectChain: false, reportEventSpecificLogic: false }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [submitted, setSubmitted] = useState(false);
    useEffect(() => {
        if (!submitted) return;
        sendForm();
        setSubmitted(false);
    }, [submitted]);
}
`,
				options: [{ reportEventFlag: false, reportEventSpecificLogic: false }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ properties }) {
    const [submitted, setSubmitted] = useState(false);
    useEffect(() => {
        if (!submitted) return;
        sendForm();
        setSubmitted(false);
    }, [properties.submitted]);
}
`,
				options: [{ reportEventSpecificLogic: false }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [raw, setRaw] = useState(0);
    const [derived, setDerived] = useState(0);

    useEffect(() => {
        setRaw(1);
        console.log("raw changed");
    }, []);

    useEffect(() => {
        setDerived(raw + 1);
    }, [raw]);
}
`,
				options: [{ reportDerivedState: false, reportInitializeState: false }],
			},
			{
				code: `
import { useEffect } from "not-react";

function Component({ onChange, value }) {
    useEffect(() => {
        onChange(value);
    }, [onChange, value]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [value, setValue] = useState(0);

    async function syncValue(): Promise<void> {
        setValue(1);
    }

    useEffect(syncValue, []);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

const hooks = {
    useReady({ onReady }) {
        useEffect(() => {
            onReady();
        }, [onReady]);
    },
};
void hooks;
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

class Hooks {
    useReady({ onReady }) {
        useEffect(() => {
            onReady();
        }, [onReady]);
    }
}
void Hooks;
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [card, setCard] = useState(null);
    const [goldCardCount, setGoldCardCount] = useState(0);

    useEffect(() => {
        if (card !== null && card.gold) {
            setGoldCardCount(c => c + 1);
        }
    }, [card]);

    useEffect(() => {
        if (goldCardCount > 3) {
            setCard(null);
        }
    }, [goldCardCount]);
}
`,
				options: [{ reportEffectChain: false }],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(() => {
        ping();
    }, []);

    useEffect(() => {
        pong();
    }, []);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [submitted, setSubmitted] = useState(false);
    useEffect(() => {
        if (!submitted) return;
        setSubmitted(false);
        setSubmitted(true);
    }, [submitted]);
}
`,
				options: [{ reportEffectChain: false }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [submitted, setSubmitted] = useState(false);
    useEffect(() => {
        if (!submitted) {
            return;
        } else {
            markSkipped();
        }
        sendForm();
        setSubmitted(false);
    }, [submitted]);
}
`,
				options: [{ reportEventSpecificLogic: false }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [submitted, setSubmitted] = useState(false);
    useEffect(() => {
        if (submitted) return;
        sendForm();
        setSubmitted(false);
    }, [submitted]);
}
`,
				options: [{ reportEventSpecificLogic: false }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [submitted, setSubmitted] = useState(false);
    useEffect(() => {
        if (!submitted) {
            setSubmitted(false);
            sendForm();
        }
    }, [submitted]);
}
`,
				options: [{ reportEventSpecificLogic: false }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [submitted, setSubmitted] = useState(false);
    useEffect(() => {
        if (submitted) {
            setSubmitted(false);
            setSubmitted(true);
        }
    }, [submitted]);
}
`,
				options: [{ reportEffectChain: false }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [submitted, setSubmitted] = useState(false);
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        if (!submitted) return;
        setSaving(true);
        setSubmitted(false);
    }, [submitted]);
}
`,
				options: [{ reportEffectChain: false }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [submitted, setSubmitted] = useState(false);
    useEffect(() => {
        if (submitted) {
            sendForm();
            setSubmitted(false);
        }
    });
}
`,
				options: [{ reportEventSpecificLogic: false }],
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ onChange, value, fallback }) {
    useEffect(() => {
        if (value) {
            onChange(value);
        } else {
            onChange(fallback);
        }
    }, [onChange, value, fallback]);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component(...properties) {
    useEffect(() => {
        ping(properties);
    }, []);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ ...properties }) {
    useEffect(() => {
        ping(properties);
    }, []);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component(properties) {
    useEffect(() => {
        properties["onChange"]();
    }, [properties]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [value, setValue] = useState(0);
    useEffect(() => {
    }, []);
}
`,
				options: [{ reportEmptyEffect: false }],
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ ready }) {
    const [value, setValue] = useState(0);
    useEffect(() => {
        if (ready) {
            setValue(1);
        } else {
            setValue(2);
        }
    }, []);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [value, setValue] = useState(0);
    useEffect(() => {
        setValue();
    }, []);
}
`,
			},
			{
				code: `
import { "" as empty, useEffect } from "@rbxts/react";

function Component() {
    useEffect(() => {
        ping(empty);
    }, []);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ userId, token }) {
    useEffect(() => {
        fetchUser(userId);
    }, [userId]);

    useEffect(() => {
        fetchToken(userId, token);
    }, [userId, token]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ items }) {
    const [selectedItems, setSelectedItems] = useState([]);
    useEffect(() => {
        setSelectedItems(...items);
    }, [items]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component(properties) {
    const [value, setValue] = useState(0);
    const syncValue = () => setValue(properties.value);
    useEffect(syncValue, [properties.value]);
}
`,
			},
			{
				code: `
import { useEffect, useState, useRef } from "@rbxts/react";

function Component() {
    const state = useState(0);
    const [value] = useState(0);
    const [, , setReady] = useState(false);
    const [ref] = useRef();

    useEffect(() => {
        ping(state, value, setReady, ref);
    }, []);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ value }) {
    const [localValue, setLocalValue] = useState(0);
    useEffect(() => {
        setLocalValue(value);
        fetch(value);
    }, [value]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ value }) {
    const [localValue, setLocalValue] = useState(0);
    useEffect(() => {
        if (value > 0) {
            sendMetric(value);
        }
        setLocalValue(value);
    }, [value]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ value }) {
    const [localValue, setLocalValue] = useState(0);
    useEffect(() => {
        setLocalValue(value);
        console.log(value);
    }, [value]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ api, value }) {
    const [localValue, setLocalValue] = useState(0);
    useEffect(() => {
        setLocalValue(value);
        api.sendUpdate(value);
    }, [api, value]);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ onChange, value }) {
    useEffect(() => onChange(value), [onChange, value]);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ [getKey()]: handleChange, value }) {
    useEffect(() => {
        handleChange(value);
    }, [handleChange, value]);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ onChange: { nested }, value }) {
    useEffect(() => {
        nested(value);
    }, [nested, value]);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(() => {
        const connection = connect();
        return () => disconnect(connection);
    }, []);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(async () => {
        await fetchData();
    }, []);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component(properties) {
    const [value, setValue] = useState(0);
    useEffect(() => {
        setValue(properties.count);
        logChange(properties.count);
    }, [properties.count]);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ onChange, value }) {
    useEffect(() => {
        if (!value) return;
        logChange(value);
        onChange(value);
    }, [onChange, value]);
}
`,
			},
			{
				code: `
import React from "@rbxts/react";

function Component(properties) {
    React["useEffect"](() => {
        properties.onChange?.(properties.value);
    }, [properties.value, properties.onChange]);
}
`,
			},
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [submitted, setSubmitted] = useState(false);
    useEffect(() => {
        if (!submitted) return;
        sendForm();
        setSubmitted(false);
    }, []);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(() => {
        return () => cleanup();
        function helper() {
            return () => ignored();
        }
    }, []);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(() => {
        function helper() {
            return () => cleanup();
        }
        helper();
    }, []);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(() => {
        for (const item of items) {
            return () => cleanup(item);
        }
    }, [items]);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(() => {
        for (let index = 0; index < 1; index += 1) {
            return () => cleanup(index);
        }
    }, []);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(() => {
        label: {
            return () => cleanup();
        }
    }, []);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(() => {
        switch (getMode()) {
            case "open":
                return () => cleanup();
            default:
                return;
        }
    }, []);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(() => {
        try {
            start();
        } finally {
            return () => stop();
        }
    }, []);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(() => {
        while (shouldContinue()) {
            return () => stop();
        }
    }, []);
}
`,
			},
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(() => {
        try {
            start();
        } catch (error) {
            report(error);
            return () => stop();
        }
    }, []);
}
`,
			},

			// ========== NEW VALID: Legitimate useEffect usage ==========

			// Data fetching with cleanup
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ userId }) {
    const [data, setData] = useState(null);
    useEffect(() => {
        const controller = new AbortController();
        fetchUser(userId, { signal: controller.signal })
            .then(setData);
        return () => controller.abort();
    }, [userId]);
}
`,
			},

			// External system sync without setState
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ title }) {
    useEffect(() => {
        document.title = title;
    }, [title]);
}
`,
			},

			// Analytics tracking
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(() => {
        trackPageView("/home");
    }, []);
}
`,
			},

			// Named function with actual side effects
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ isOpen }) {
    function handleToggle(): void {
        document.body.style.overflow = isOpen ? "hidden" : "";
    }
    useEffect(handleToggle, [isOpen]);
}
`,
			},

			// WebSocket connection
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ channelId }) {
    useEffect(() => {
        const ws = new WebSocket(\`wss://example.com/\${channelId}\`);
        ws.onmessage = (event) => {
            handleMessage(event.data);
        };
        return () => ws.close();
    }, [channelId]);
}
`,
			},

			// Third-party library integration
			{
				code: `
import { useEffect, useRef } from "@rbxts/react";

function Component() {
    const canvasRef = useRef();
    useEffect(() => {
        const chart = new Chart(canvasRef.current, { type: "line" });
        return () => chart.destroy();
    }, []);
}
`,
			},

			// Timer/interval
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component() {
    useEffect(() => {
        const interval = setInterval(() => {
            pollServer();
        }, 5000);
        return () => clearInterval(interval);
    }, []);
}
`,
			},

			// Local storage sync (external system)
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ key, value }) {
    useEffect(() => {
        localStorage.setItem(key, JSON.stringify(value));
    }, [key, value]);
}
`,
			},

			// Animation library integration
			{
				code: `
import { useEffect, useRef } from "@rbxts/react";

function Component({ isOpen }) {
    const ref = useRef();
    useEffect(() => {
        const animation = animate(ref.current, { opacity: isOpen ? 1 : 0 });
        return () => animation.cancel();
    }, [isOpen]);
}
`,
			},

			// Effect with non-empty deps but no state setting
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ query }) {
    useEffect(() => {
        sendSearchAnalytics(query);
    }, [query]);
}
`,
			},

			// Named effect function with external side effects
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ userId }) {
    function syncUser(): void {
        api.syncUser(userId);
    }
    useEffect(syncUser, [userId]);
}
`,
			},

			// Different dependency arrays (not duplicate)
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ userId, projectId }) {
    useEffect(() => {
        fetchUser(userId);
    }, [userId]);

    useEffect(() => {
        fetchProject(projectId);
    }, [projectId]);
}
`,
			},

			// Effect chain with actual side effects (valid)
			// This has no state setters in the second effect, so it's legitimate
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component({ userId }) {
    const [data, setData] = useState(null);

    useEffect(() => {
        // Async data fetching - legitimate synchronization
        void (async () => {
            const result = await fetchData(userId);
            setData(result);
        })();
    }, [userId]);

    useEffect(() => {
        if (data) {
            processData(data);
        }
    }, [data]);
}
`,
			},

			// ========== REGRESSION: False-positive guards ==========

			// Duplicate deps across separate hooks should be valid
			{
				code: `
import { useEffect } from "react";

export function usePrimary(total: number, sync?: (value: number) => void): void {
    function runPrimarySync(): void {
        sync?.(total + 1);
    }
    useEffect(runPrimarySync, [total, sync]);
}

export function useSecondary(total: number, sync?: (value: number) => void): void {
    function runSecondarySync(): void {
        sync?.(total + 2);
    }
    useEffect(runSecondarySync, [total, sync]);
}
`,
				options: [{ environment: "standard", reportEffectChain: false }],
			},

			// Subscription lifecycle with cleanup
			{
				code: `
import { useEffect, useState } from "react";

type Channel = {
    listen: (listener: (next: string) => void) => () => void;
};

export function useChannelValue(channel: Channel): string {
    const [value, setValue] = useState("");

    useEffect(() => {
        return channel.listen((next) => {
            setValue(next);
        });
    }, [channel]);

    return value;
}
`,
				options: [{ environment: "standard", reportDerivedState: false }],
			},

			// Async resolution with cancellation guard
			{
				code: `
import { useEffect, useState } from "react";

export function useAsyncTitle(task: Promise<string>): string | undefined {
    const [title, setTitle] = useState<string | undefined>(undefined);

    function syncAsyncTitle(): () => void {
        let cancelled = false;

        task.then((nextTitle) => {
            if (cancelled) return;
            setTitle(nextTitle);
        });

        return () => {
            cancelled = true;
        };
    }

    useEffect(syncAsyncTitle, [task]);
    return title;
}
`,
				options: [{ environment: "standard" }],
			},
			{
				code: `
import { useEffect, useState } from "react";

export function useEventFlagNearMiss({ submitted, sendForm }: { submitted: boolean; sendForm: () => void }): void {
    const [localSubmitted, setLocalSubmitted] = useState(false);

    useEffect(() => {
        if (!localSubmitted) {
            setLocalSubmitted(false);
        } else {
            sendForm();
        }
    }, [localSubmitted, sendForm]);
}
`,
				options: [{ environment: "standard", reportEffectChain: false }],
			},
			{
				code: `
import { useEffect, useState } from "react";

export function useEventFlagWrongPolarity(sendForm: () => void): void {
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        if (submitted) return;
        setSubmitted(false);
        sendForm();
    }, [submitted, sendForm]);
}
`,
				options: [{ environment: "standard", reportEffectChain: false }],
			},
			{
				code: `
import { useEffect, useState } from "react";

export function useEventFlagNoSideEffect(): void {
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        if (!submitted) return;
        setSubmitted(false);
        setSubmitted(false);
    }, [submitted]);
}
`,
				options: [{ environment: "standard", reportEffectChain: false }],
			},
			{
				code: `
import { useEffect, useState } from "react";

export function useEventFlagNonFalseReset(sendForm: () => void): void {
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        if (!submitted) return;
        setSubmitted(true);
        sendForm();
    }, [submitted, sendForm]);
}
`,
				options: [{ environment: "standard", reportEffectChain: false }],
			},
			{
				code: `
import { useEffect, useState } from "react";

export function useResetNearMiss(userId: string): void {
    const [settings, setSettings] = useState({});

    useEffect(() => {
        setSettings({}, userId);
    }, [userId]);
}
`,
				options: [{ environment: "standard", reportDerivedState: false }],
			},
			{
				code: `
import { useEffect, useState } from "react";

export function useNonArrayDeps(count: number): void {
    const [value, setValue] = useState(0);

    useEffect(() => {
        setValue(1);
    }, count);

    void value;
}
`,
				options: [{ environment: "standard" }],
			},

			// Timer orchestration with cleanup
			{
				code: `
import { useEffect, useRef, useState } from "react";

export function useStaggeredVisibility(isVisible: boolean, waitMs: number): boolean {
    const [shown, setShown] = useState(isVisible);
    const pendingTimer = useRef<number | undefined>(undefined);

    function applyVisibility(): () => void {
        if (isVisible) {
            if (pendingTimer.current !== undefined) {
                clearTimeout(pendingTimer.current);
                pendingTimer.current = undefined;
            }
            setShown(true);
            return () => {};
        }

        pendingTimer.current = window.setTimeout(() => {
            setShown(false);
            pendingTimer.current = undefined;
        }, waitMs);

        return () => {
            if (pendingTimer.current !== undefined) {
                clearTimeout(pendingTimer.current);
                pendingTimer.current = undefined;
            }
        };
    }

    useEffect(applyVisibility, [isVisible, waitMs]);
    return shown;
}
`,
				options: [{ environment: "standard" }],
			},

			// Imperative animation bridge
			{
				code: `
import { useEffect } from "react";

type MotionController = {
    pushTarget: (next: number) => void;
};

export function useMotionBridge(goal: number, controller: MotionController): void {
    useEffect(() => {
        controller.pushTarget(goal);
    }, [goal, controller]);
}
`,
				options: [{ environment: "standard" }],
			},

			// Observer registration with teardown
			{
				code: `
import { useEffect, useState } from "react";

type Watch = (key: "focus" | "hover", listener: (value: boolean) => void) => () => void;

export function useFocusHoverState(watch: Watch): boolean {
    const [active, setActive] = useState(false);

    function bindObservers(): () => void {
        const stopFocus = watch("focus", (value) => {
            setActive(value);
        });
        const stopHover = watch("hover", (value) => {
            setActive(value);
        });

        return () => {
            stopFocus();
            stopHover();
        };
    }

    useEffect(bindObservers, [watch]);
    return active;
}
`,
				options: [{ environment: "standard" }],
			},

			// Custom hook callback notification
			{
				code: `
import { useEffect } from "react";

interface ReadySignalInput {
    readonly ready: boolean;
    readonly onReady?: () => void;
}

export function useReadySignal({ ready, onReady }: ReadySignalInput): void {
    function notifyReady(): void {
        if (!ready) return;
        onReady?.();
    }

    useEffect(notifyReady, [ready, onReady]);
}
`,
				options: [{ environment: "standard" }],
			},

			// InitializeState disabled via options
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [name, setName] = useState<string | undefined>();
    useEffect(() => {
        setName("Hello World");
    }, []);
}
`,
				options: [{ reportInitializeState: false }],
			},

			// LogOnly disabled via options
			{
				code: `
import { useEffect } from "@rbxts/react";

function Component({ value }) {
    useEffect(() => {
        console.log("Value changed:", value);
    }, [value]);
}
`,
				options: [{ reportLogOnly: false }],
			},

			// ExternalStore disabled via options
			{
				code: `
import { useEffect, useState } from "@rbxts/react";

function Component() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        window.addEventListener("online", handleOnline);
        return () => window.removeEventListener("online", handleOnline);
    }, []);
}
`,
				options: [{ reportExternalStore: false }],
			},
		],
	});
});
