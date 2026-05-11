import { extname as e } from "node:path";
import { regex as n } from "arktype";
import { parseSync as t } from "oxc-parser";
function r(e) {
	return e;
}
function i(e) {
	return e;
}
function a(e, t) {
	return e.type === `TSArrayType`
		? `Array<${a(e.elementType, t)}>`
		: e.type === `TSTypeOperator` && e.operator === `readonly` && e.typeAnnotation.type === `TSArrayType`
			? `ReadonlyArray<${a(e.typeAnnotation.elementType, t)}>`
			: t.getText(e);
}
function o({ parent: e }) {
	return !(
		(e.type === `TSRestType` && e.parent.type === `TSTupleType`) ||
		e.type === `TSTupleType` ||
		e.type === `TSArrayType` ||
		(e.type === `TSTypeOperator` && e.operator === `readonly`)
	);
}
const s = i({
	create(e) {
		function t(t) {
			e.report({
				fix(n) {
					return n.replaceText(t, a(t, e.sourceCode));
				},
				messageId: `useGenericArrayType`,
				node: t,
			});
		}
		return {
			TSArrayType(e) {
				o(e) && t(e);
			},
			TSTypeOperator(e) {
				e.operator !== `readonly` || e.typeAnnotation.type !== `TSArrayType` || (o(e) && t(e));
			},
		};
	},
	meta: {
		docs: { description: `Disallow bracket array type syntax and require Array<T> / ReadonlyArray<T>.` },
		fixable: `code`,
		messages: {
			useGenericArrayType: `Bracket array type syntax is not allowed. Use Array<T> or ReadonlyArray<T> generic syntax.`,
		},
		schema: [],
		type: `problem`,
	},
});
function c(e) {
	return typeof e == `object` && !!e && !Array.isArray(e);
}
function l(e) {
	if (!Array.isArray(e)) return !1;
	for (let t of e) if (typeof t != `string`) return !1;
	return !0;
}
function u(e) {
	if (!c(e)) return !1;
	for (let t of Object.values(e)) if (typeof t != `string`) return !1;
	return !0;
}
const d = new Map([[`omit`, { originalName: `Omit`, replacementName: `Except` }]]);
function f(e) {
	let t = new Map(d);
	if (!c(e) || !(`bannedTypes` in e)) return t;
	let { bannedTypes: n } = e;
	if (n === void 0) return t;
	if (l(n)) {
		for (let e of n) t.set(e.toLowerCase(), { originalName: e, replacementName: void 0 });
		return t;
	}
	if (u(n)) for (let [e, r] of Object.entries(n)) t.set(e.toLowerCase(), { originalName: e, replacementName: r });
	return t;
}
function p(e) {
	if (e.type === `Identifier`) return e.name;
	if (e.type === `TSQualifiedName`) return e.right.name;
}
const m = i({
		create(e) {
			let [t] = e.options,
				n = f(t);
			return n.size === 0
				? {}
				: {
						TSTypeReference(t) {
							let r = p(t.typeName);
							if (r === void 0) return;
							let i = n.get(r.toLowerCase());
							if (i !== void 0) {
								if (i.replacementName !== void 0 && i.replacementName !== ``) {
									e.report({
										data: { replacementName: i.replacementName, typeName: i.originalName },
										messageId: `bannedTypeWithReplacement`,
										node: t.typeName,
									});
									return;
								}
								e.report({
									data: { typeName: i.originalName },
									messageId: `bannedType`,
									node: t.typeName,
								});
							}
						},
					};
		},
		meta: {
			docs: { description: `Ban configured TypeScript utility types, defaulting to Omit in favor of Except.` },
			messages: {
				bannedType: `Type '{{typeName}}' is banned by project configuration. Use the project-preferred alternative for this type.`,
				bannedTypeWithReplacement: `Type '{{typeName}}' is banned. Use '{{replacementName}}' instead.`,
			},
			schema: [
				{
					additionalProperties: !1,
					properties: {
						bannedTypes: {
							description: `Array of banned type names or an object mapping banned type names to preferred replacement names.`,
							oneOf: [
								{ items: { type: `string` }, type: `array` },
								{ additionalProperties: { type: `string` }, type: `object` },
							],
						},
					},
					type: `object`,
				},
			],
			type: `problem`,
		},
	}),
	h = new Set([`end`, `loc`, `parent`, `range`, `start`, `type`]);
function g(e) {
	return c(e) && typeof e.type == `string`;
}
function _(e) {
	return h.has(e);
}
function v(e) {
	return e.type === `VariableDeclarator`;
}
function ee(e) {
	return e.type === `Literal` && typeof e.value == `number`;
}
function te(e) {
	return e.type === `CallExpression`;
}
function y(e) {
	return e.type === `MemberExpression`;
}
function b(e) {
	return e.type === `UnaryExpression`;
}
function x(e) {
	return w(e) || ce(e);
}
function ne(e) {
	return e.type === `BinaryExpression`;
}
function re(e) {
	return e.type === `LogicalExpression`;
}
function ie(e) {
	return e.type === `ConditionalExpression`;
}
function ae(e) {
	return e.type === `SequenceExpression`;
}
function S(e) {
	return e.type === `PropertyDefinition` || e.type === `TSAbstractPropertyDefinition`;
}
function C(e) {
	return e.type === `VariableDeclaration`;
}
function w(e) {
	return e.type === `FunctionDeclaration` || e.type === `FunctionExpression`;
}
function oe(e) {
	return e.type === `ClassDeclaration` || e.type === `ClassExpression`;
}
function se(e) {
	return e.type === `Literal`;
}
function ce(e) {
	return e.type === `ArrowFunctionExpression`;
}
function le(e) {
	return e.type === `NewExpression`;
}
function ue(e) {
	return e.type === `ArrayExpression`;
}
function de(e) {
	return e.type === `ObjectExpression`;
}
function fe(e) {
	return e.type === `TemplateLiteral`;
}
function pe(e) {
	return e.type === `ExpressionStatement`;
}
function me(e) {
	return e.type === `TSTypeAssertion`;
}
function he(e) {
	return e.type === `TSAsExpression`;
}
function T(e) {
	return e.type === `AssignmentPattern`;
}
function ge(e) {
	return e.type === `ThisExpression`;
}
function E(e) {
	return e.type === `Identifier` && typeof e.name == `string`;
}
function _e(e) {
	return e.type === `AssignmentExpression`;
}
function D(e) {
	return e.type === `ExportNamedDeclaration`;
}
function O(e) {
	return e.type === `ExportSpecifier`;
}
function k(e) {
	return e.type === `Identifier`;
}
function ve(e) {
	return e.type === `ImportDeclaration`;
}
function ye(e) {
	return e.type === `ImportDefaultSpecifier`;
}
function be(e) {
	return e.type === `ImportNamespaceSpecifier`;
}
function xe(e) {
	return e.type === `ImportSpecifier`;
}
function Se(e) {
	return e.type === `JSXIdentifier` && `name` in e;
}
function Ce(e) {
	return e.type === `MethodDefinition` || e.type === `TSAbstractMethodDefinition`;
}
function we(e) {
	return e.type === `ObjectExpression`;
}
function A(e) {
	return e.type === `Property`;
}
function j(e) {
	return e.type === `Literal` && typeof e.value == `string`;
}
function Te(e) {
	return e.type === `TSTypeAliasDeclaration`;
}
function M(e) {
	if (!te(e) || e.optional) return !1;
	let { callee: t } = e;
	if (!k(t) || t.name !== `require` || e.arguments.length !== 1) return !1;
	let [n] = e.arguments;
	return n !== void 0 && j(n);
}
function Ee(e) {
	return e.type === `TSQualifiedName`;
}
function N(e) {
	let t = e;
	for (;;)
		switch (t.type) {
			case `ChainExpression`:
			case `ParenthesizedExpression`:
			case `TSAsExpression`:
			case `TSInstantiationExpression`:
			case `TSNonNullExpression`:
			case `TSSatisfiesExpression`:
			case `TSTypeAssertion`:
				t = t.expression;
				break;
			default:
				return t;
		}
}
function P(e) {
	return e.computed
		? e.property.type === `Literal` && typeof e.property.value == `string`
			? e.property.value
			: void 0
		: e.property.type === `Identifier`
			? e.property.name
			: void 0;
}
function De(e, t, n) {
	let r = e.getScope(t);
	for (; r !== null; ) {
		let e = r.set.get(n);
		if (e !== void 0 && e.defs.length > 0) return !0;
		r = r.upper;
	}
	return !1;
}
function Oe(e, t) {
	let n = [e];
	for (; n.length > 0; ) {
		let e = n.pop();
		if (e === void 0) break;
		t(e);
		for (let t in e) {
			if (_(t)) continue;
			let r = Reflect.get(e, t);
			if (!(typeof r != `object` || !r) && r !== e.parent) {
				if (Array.isArray(r)) {
					for (let e = r.length - 1; e >= 0; --e) {
						let t = r[e];
						g(t) && n.push(t);
					}
					continue;
				}
				g(r) && n.push(r);
			}
		}
	}
}
const F = { environment: `standard`, requireExplicitGenericOnNewArray: !0 };
function I(e) {
	return e.type === `Identifier`;
}
function L(e, t) {
	let n = N(t.callee);
	return !I(n) || n.name !== `Array` ? !1 : !De(e, n, `Array`);
}
function R(e, t) {
	if (
		e.type !== `TSTypeReference` ||
		!I(e.typeName) ||
		(e.typeName.name !== `Array` && e.typeName.name !== `ReadonlyArray`) ||
		e.typeArguments?.params.length !== 1
	)
		return;
	let [n] = e.typeArguments.params;
	return n === void 0 ? void 0 : t.getText(n);
}
const ke = /:\s*(Array<.+>|ReadonlyArray<.+>)\s*=/u;
function Ae(e) {
	return ke.exec(e) !== null;
}
function z(e) {
	if (I(e) || e.type === `ArrayPattern` || e.type === `ObjectPattern`) return e.typeAnnotation ?? void 0;
}
function je(e, t) {
	let { parent: n } = e;
	if (v(n) && n.init === e) {
		let e = z(n.id);
		return e === void 0 ? !1 : R(e.typeAnnotation, t) !== void 0;
	}
	return T(n) && n.right === e
		? Ae(t.getText(n))
		: S(n) && n.value === e && n.typeAnnotation !== void 0 && n.typeAnnotation !== null
			? R(n.typeAnnotation.typeAnnotation, t) !== void 0
			: (he(n) && n.expression === e) || (me(n) && n.expression === e)
				? R(n.typeAnnotation, t) !== void 0
				: !1;
}
function Me(e) {
	if (e === void 0) return !1;
	let { typeAnnotation: t } = e;
	return t.type !== `TSTypeReference` || !I(t.typeName) ? !1 : t.typeName.name === `ReadonlyArray`;
}
function B(e) {
	let t = N(e);
	return se(t) && `value` in t
		? typeof t.value != `number`
		: ue(t) || de(t) || ce(t) || w(t) || oe(t)
			? !0
			: fe(t)
				? t.expressions.length === 0
				: b(t)
					? t.operator === `void` || (t.operator === `typeof` && !t.prefix)
					: !1;
}
function Ne(e) {
	return e.type === `Identifier` || e.type === `PrivateIdentifier` ? !0 : V(e);
}
function V(e) {
	let t = N(e);
	if (I(t) || ge(t)) return !0;
	if (y(t)) return t.optional || t.object.type === `Super` || !V(t.object) ? !1 : t.computed ? V(t.property) : !0;
	if (b(t)) return t.operator === `delete` ? !1 : V(t.argument);
	if (ne(t) || re(t)) return V(t.left) && V(t.right);
	if (ie(t)) return V(t.test) && V(t.consequent) && V(t.alternate);
	if (fe(t)) {
		for (let e of t.expressions) if (!V(e)) return !1;
		return !0;
	}
	if (ue(t)) {
		for (let e of t.elements) if (e !== null && (e.type === `SpreadElement` || !V(e))) return !1;
		return !0;
	}
	if (de(t)) {
		for (let e of t.properties)
			if (
				e.type === `SpreadElement` ||
				e.kind !== `init` ||
				e.method ||
				(e.computed && !Ne(e.key)) ||
				!V(e.value)
			)
				return !1;
		return !0;
	}
	if (ae(t)) {
		for (let e of t.expressions) if (!V(e)) return !1;
		return !0;
	}
	return se(t);
}
function H(e, t) {
	let n = N(e);
	if (
		!(!te(n) || n.optional) &&
		!(!y(n.callee) || n.callee.optional) &&
		!(!I(n.callee.object) || n.callee.object.name !== t)
	)
		return P(n.callee) === `push` ? n : void 0;
}
function Pe(e, t, n) {
	for (let r = t; r < e.length; r += 1) {
		let t = e[r];
		if (!(t === void 0 || !pe(t)) && H(t.expression, n) !== void 0) return !0;
	}
	return !1;
}
function Fe(e, t) {
	let n = [],
		r = 0;
	for (let i of e) {
		if (i.type === `SpreadElement`) {
			n[r++] = `...${t.getText(i.argument)}`;
			continue;
		}
		n[r++] = t.getText(i);
	}
	return `[${n.join(`, `)}]`;
}
function U(e, t, n, r, i) {
	if (n.init === null || r.length === 0) return [];
	let [a] = r,
		o = r.at(-1);
	if (a === void 0 || o === void 0) return [];
	let [s] = a.range;
	for (; s > 0; ) {
		let e = t.text[s - 1];
		if (e === ` ` || e === `	`) {
			--s;
			continue;
		}
		e ===
			`
` && --s;
		break;
	}
	return [e.replaceText(n.init, i), e.removeRange([s, o.range[1]])];
}
const Ie = i({
	create(e) {
		let t = e.options?.[0],
			n = typeof t == `object` && t ? { ...F, ...t } : { ...F },
			{ sourceCode: r } = e;
		function i(t) {
			for (let n = 0; n < t.length; n += 1) {
				let i = t[n];
				if (i === void 0 || !C(i) || (i.kind !== `const` && i.kind !== `let`) || i.declarations.length !== 1)
					continue;
				let [a] = i.declarations;
				if (
					a === void 0 ||
					!I(a.id) ||
					a.init === null ||
					!le(a.init) ||
					!L(r, a.init) ||
					a.init.arguments.length > 0 ||
					Me(z(a.id))
				)
					continue;
				let o = a.id.name,
					s = [],
					c = [],
					l = !1,
					u = n + 1;
				for (; u < t.length; ) {
					let e = t[u];
					if (e === void 0 || !pe(e)) break;
					let n = H(e.expression, o);
					if (n === void 0 || n.arguments.length === 0) break;
					s.push(e);
					for (let e of n.arguments) {
						if (e.type === `SpreadElement`) {
							((l = !0), c.push(`...${r.getText(e.argument)}`));
							continue;
						}
						c.push(r.getText(e));
					}
					u += 1;
				}
				if (s.length === 0 || Pe(t, u, o)) continue;
				let d = `[${c.join(`, `)}]`;
				if (
					!(
						l ||
						s.some((e) => {
							let t = H(e.expression, o);
							if (t === void 0) return !0;
							for (let e of t.arguments) if (e.type === `SpreadElement` || !V(e)) return !0;
							return !1;
						})
					)
				) {
					e.report({
						fix(e) {
							return U(e, r, a, s, d);
						},
						messageId: `collapseArrayPushInitialization`,
						node: i,
					});
					continue;
				}
				e.report({
					messageId: `collapseArrayPushInitialization`,
					node: i,
					suggest: [
						{
							fix(e) {
								return U(e, r, a, s, d);
							},
							messageId: `suggestCollapseArrayPushInitialization`,
						},
					],
				});
			}
		}
		return {
			BlockStatement(e) {
				i(e.body);
			},
			NewExpression(t) {
				if (!L(r, t)) return;
				if (t.arguments.length === 0) {
					if (
						!n.requireExplicitGenericOnNewArray ||
						(t.typeArguments !== void 0 && t.typeArguments !== null && t.typeArguments.params.length > 0) ||
						je(t, r)
					)
						return;
					e.report({ messageId: `requireExplicitGenericOnNewArray`, node: t });
					return;
				}
				if (t.arguments.length > 1) {
					let [i] = t.arguments;
					if (
						(i !== void 0 && i.type !== `SpreadElement` && n.environment === `roblox-ts` && !B(i)) ||
						i === void 0
					)
						return;
					let a = Fe(t.arguments, r);
					if (!t.arguments.some((e) => e.type === `SpreadElement`)) {
						e.report({
							fix(e) {
								return e.replaceText(t, a);
							},
							messageId: `avoidConstructorEnumeration`,
							node: t,
						});
						return;
					}
					e.report({
						messageId: `avoidConstructorEnumeration`,
						node: t,
						suggest: [
							{
								fix(e) {
									return e.replaceText(t, a);
								},
								messageId: `suggestArrayLiteral`,
							},
						],
					});
					return;
				}
				let [i] = t.arguments;
				if (i === void 0) return;
				if (i.type === `SpreadElement`) {
					e.report({
						messageId: `avoidSingleArgumentConstructor`,
						node: t,
						suggest: [
							{
								fix(e) {
									return e.replaceText(t, `[...${r.getText(i.argument)}]`);
								},
								messageId: `suggestArrayLiteral`,
							},
						],
					});
					return;
				}
				if (!B(i)) {
					if (
						n.environment === `roblox-ts` ||
						(t.typeArguments !== void 0 && t.typeArguments !== null && t.typeArguments.params.length > 0)
					)
						return;
					let a = r.getText(i);
					e.report({
						messageId: `avoidLengthConstructorInStandard`,
						node: t,
						suggest: [
							{
								fix(e) {
									return e.replaceText(t, `Array.from({ length: ${a} })`);
								},
								messageId: `suggestArrayFromLength`,
							},
						],
					});
					return;
				}
				let a = `[${r.getText(i)}]`;
				e.report({
					fix(e) {
						return e.replaceText(t, a);
					},
					messageId: `avoidSingleArgumentConstructor`,
					node: t,
				});
			},
			Program(e) {
				i(e.body);
			},
		};
	},
	meta: {
		docs: {
			description: `Disallow array constructor element forms and enforce roblox-ts-aware constructor patterns.`,
		},
		fixable: `code`,
		hasSuggestions: !0,
		messages: {
			avoidConstructorEnumeration: `Do not use Array constructor enumeration arguments. Use an array literal instead.`,
			avoidLengthConstructorInStandard: `Length-based Array constructor is not allowed in standard mode. Prefer Array.from({ length: n }).`,
			avoidSingleArgumentConstructor: `Single-argument Array constructor form is not allowed here. Use an array literal instead.`,
			collapseArrayPushInitialization: `Collapse new Array<T>() + consecutive .push(...) calls into a single array literal initializer.`,
			requireExplicitGenericOnNewArray: `new Array() must use an explicit generic argument or a contextual Array<T>/ReadonlyArray<T> annotation.`,
			suggestArrayFromLength: `Replace with Array.from({ length: value }).`,
			suggestArrayLiteral: `Replace constructor form with an array literal.`,
			suggestCollapseArrayPushInitialization: `Collapse constructor + push sequence into a single array literal initializer.`,
		},
		schema: [
			{
				additionalProperties: !1,
				properties: {
					environment: {
						default: `standard`,
						description: `Array constructor environment mode: 'roblox-ts' allows new Array(length); 'standard' reports it.`,
						enum: [`roblox-ts`, `standard`],
						type: `string`,
					},
					requireExplicitGenericOnNewArray: {
						default: !0,
						description: `When true, zero-argument new Array() requires explicit generic type arguments or contextual array typing.`,
						type: `boolean`,
					},
				},
				type: `object`,
			},
		],
		type: `problem`,
	},
});
function W(e) {
	return e.type !== `PrivateIdentifier`;
}
function G(e, t, n) {
	if (e.type !== t.type) return !1;
	switch (e.type) {
		case `CallExpression`:
			return t.type === `CallExpression` && n.getText(e) === n.getText(t);
		case `Identifier`:
			return t.type === `Identifier` && e.name === t.name;
		case `Literal`:
			return t.type === `Literal` && e.value === t.value && e.raw === t.raw;
		case `MemberExpression`:
			return t.type !== `MemberExpression` ||
				e.computed !== t.computed ||
				e.optional !== t.optional ||
				!G(e.object, t.object, n)
				? !1
				: e.computed
					? !W(e.property) || !W(t.property)
						? !1
						: G(e.property, t.property, n)
					: e.property.type === `PrivateIdentifier` || t.property.type === `PrivateIdentifier`
						? e.property.type === `PrivateIdentifier` &&
							t.property.type === `PrivateIdentifier` &&
							e.property.name === t.property.name
						: t.property.type === `Identifier` && e.property.name === t.property.name;
		case `Super`:
			return t.type === `Super`;
		case `ThisExpression`:
			return t.type === `ThisExpression`;
		default:
			return !1;
	}
}
function Le(e) {
	switch (e.type) {
		case `Identifier`:
		case `Literal`:
		case `ThisExpression`:
			return !0;
		case `MemberExpression`:
			return e.optional || !K(e.object)
				? !1
				: e.computed
					? W(e.property)
						? Le(e.property)
						: !1
					: e.property.type === `Identifier` || e.property.type === `PrivateIdentifier`;
		default:
			return !1;
	}
}
function K(e) {
	switch (e.type) {
		case `Identifier`:
		case `ThisExpression`:
			return !0;
		case `MemberExpression`:
			return e.optional || !K(e.object)
				? !1
				: e.computed
					? W(e.property)
						? Le(e.property)
						: !1
					: e.property.type === `Identifier` || e.property.type === `PrivateIdentifier`;
		default:
			return !1;
	}
}
function Re(e) {
	return e.type !== `CallExpression` ||
		e.optional ||
		e.arguments.length > 0 ||
		e.callee.type !== `MemberExpression` ||
		e.callee.optional ||
		e.callee.computed ||
		e.callee.property.type !== `Identifier`
		? !1
		: e.callee.property.name === `size`;
}
function ze(e) {
	return typeof e != `object` || !e
		? !1
		: `allowAutofix` in e
			? e.allowAutofix === void 0 || typeof e.allowAutofix == `boolean`
			: !0;
}
const Be = i({
	create(e) {
		let [t] = e.options,
			n = ze(t) && t.allowAutofix === !0,
			{ sourceCode: r } = e;
		return {
			AssignmentExpression(t) {
				if (
					t.operator !== `=` ||
					t.left.type !== `MemberExpression` ||
					!t.left.computed ||
					!Re(t.left.property) ||
					!G(t.left.object, t.left.property.callee.object, r)
				)
					return;
				let i = t.parent.type === `ExpressionStatement` ? t.parent : void 0;
				if (!(n && i !== void 0 && K(t.left.object))) {
					e.report({ messageId: `usePush`, node: t });
					return;
				}
				let a = r.getText(t.left.object),
					o = r.getText(t.right);
				e.report({
					fix(e) {
						return e.replaceText(i, `${a}.push(${o});`);
					},
					messageId: `usePush`,
					node: t,
				});
			},
		};
	},
	meta: {
		docs: {
			description: `Disallow array append assignments using array[array.size()] = value and prefer push-based appends.`,
		},
		fixable: `code`,
		messages: { usePush: `Do not append with array[array.size()] = value. Use array.push(value) instead.` },
		schema: [
			{
				additionalProperties: !1,
				properties: { allowAutofix: { default: !1, type: `boolean` } },
				type: `object`,
			},
		],
		type: `problem`,
	},
});
function Ve(e, t) {
	let n = e.scan(t);
	return n === 0 ? 0 : 1 - (1 - e.probability) ** n;
}
function He(e, t) {
	let n = 0;
	for (let r of e) {
		let e = Ve(r, t);
		n = 1 - (1 - n) * (1 - e);
	}
	return n;
}
function Ue(e, t) {
	return He(e, t) >= 0.9;
}
function We(e, t) {
	return t.some((t) => Ue(e, t));
}
function Ge(e) {
	return {
		probability: e,
		scan(e) {
			for (let t = 0; t < e.length - 1; t += 1) {
				let n = e.charAt(t),
					r = e.charAt(t + 1);
				if (n === n.toLowerCase() && r === r.toUpperCase() && r !== r.toLowerCase()) return 1;
			}
			return 0;
		},
	};
}
const Ke = /[-/^$*+?.()|[\]{}]/gu,
	qe = String.raw`\$&`,
	Je = /\s+/gu;
function Ye(e) {
	return e.replaceAll(Ke, qe);
}
function Xe(e, t) {
	let n = t.map((e) => (typeof e == `string` ? new RegExp(Ye(e), `ug`) : new RegExp(e.source, `ug`)));
	return {
		probability: e,
		scan(e) {
			let t = e.replace(Je, ``),
				r = 0;
			for (let e of n) {
				e.lastIndex = 0;
				let n = t.match(e);
				n && (r += n.length);
			}
			return r;
		},
	};
}
const Ze = /\s/v;
function Qe(e, t) {
	let n = new Set(t);
	return {
		probability: e,
		scan(e) {
			for (let t = e.length - 1; t >= 0; --t) {
				let r = e.charAt(t);
				if (n.has(r)) return 1;
				if (!Ze.test(r) && r !== `*` && r !== `/`) return 0;
			}
			return 0;
		},
	};
}
const $e = /[ \t(),{}]/u;
function et(e, t) {
	let n = new Set(t);
	return {
		probability: e,
		scan(e) {
			let t = e.split($e),
				r = 0;
			for (let e of t) n.has(e) && (r += 1);
			return r;
		},
	};
}
const tt =
		`public.abstract.class.implements.extends.return.throw.private.protected.enum.continue.assert.boolean.this.instanceof.interface.static.void.super.true.case:.let.const.var.async.await.break.yield.typeof.import.export`.split(
			`.`,
		),
	nt = [`++`, `||`, `&&`, `===`, `?.`, `??`],
	rt = [
		`for(`,
		`if(`,
		`while(`,
		`catch(`,
		`switch(`,
		`try{`,
		`else{`,
		`this.`,
		`window.`,
		/;\s+\/\//u,
		`import '`,
		`import "`,
		`require(`,
	],
	it = [`}`, `;`, `{`];
function at() {
	return [Qe(0.95, it), et(0.7, nt), et(0.3, tt), Xe(0.95, rt), Ge(0.5)];
}
const ot = new Set([`BreakStatement`, `ContinueStatement`, `LabeledStatement`]);
function st(e) {
	return ot.has(e.type);
}
const ct = at();
function lt(e, t, n) {
	let r = e.loc.start.line,
		i = t.loc.start.line;
	if (r + 1 !== i) return !1;
	let a = n.getTokenAfter(e);
	return a ? a.loc.start.line > i : !0;
}
function ut(e, t) {
	let n = [],
		r = 0,
		i = [],
		a = 0;
	for (let o of e)
		if (o.type === `Block`)
			(a > 0 &&
				((n[r++] = {
					comments: i,
					value: i.map(({ value: e }) => e).join(`
`),
				}),
				(i = []),
				(a = 0)),
				(n[r++] = { comments: [o], value: o.value }));
		else if (a === 0) i[a++] = o;
		else {
			let e = i.at(-1);
			e && lt(e, o, t)
				? (i[a++] = o)
				: ((n[r++] = {
						comments: i,
						value: i.map(({ value: e }) => e).join(`
`),
					}),
					(i = [o]),
					(a = 1));
		}
	return (
		a > 0 &&
			(n[r] = {
				comments: i,
				value: i.map(({ value: e }) => e).join(`
`),
			}),
		n
	);
}
const dt = /\{/gv,
	ft = /\}/gv;
function pt(e) {
	let t = (e.match(dt) ?? []).length - (e.match(ft) ?? []).length;
	return t > 0 ? e + `}`.repeat(t) : t < 0 ? `{`.repeat(-t) + e : e;
}
function mt(e) {
	return We(
		ct,
		e.split(`
`),
	);
}
function ht(e) {
	return e.type !== `ReturnStatement` && e.type !== `ThrowStatement` ? !1 : e.argument?.type === `Identifier`;
}
function gt(e) {
	return e.type === `UnaryExpression` && (e.operator === `-` || e.operator === `+`);
}
function _t(e) {
	return e.type === `Literal` && (typeof e.value == `string` || typeof e.value == `number`);
}
function vt(e) {
	return c(e) && typeof e.type == `string`;
}
function yt(e) {
	let t = [],
		n = 0;
	for (let r of e) vt(r) && (t[n++] = r);
	return t;
}
function bt(e, t) {
	if (e.type !== `ExpressionStatement`) return !1;
	let { expression: n } = e;
	return n.type === `Identifier` || n.type === `SequenceExpression` || gt(n) || _t(n) || !t.trimEnd().endsWith(`;`);
}
function xt(e, t) {
	if (e.length !== 1) return !1;
	let n = e.at(0);
	return n ? st(n) || ht(n) || bt(n, t) : !1;
}
const St = [/A 'return' statement can only be used within a function body/v];
function Ct(e) {
	for (let t of e) {
		let e = !1;
		for (let n of St)
			if (n.test(t.message)) {
				e = !0;
				break;
			}
		if (!e) return !1;
	}
	return !0;
}
function wt(e) {
	return (e.errors.length === 0 || Ct(e.errors)) && e.program.body.length > 0;
}
function Tt(n, r) {
	let i = e(r),
		a = t(`file${i || `.js`}`, n);
	if (wt(a)) return a;
	if (i !== `.tsx` && i !== `.jsx`) {
		let e = t(`file.tsx`, n);
		if (wt(e)) return e;
	}
}
function Et(e, t) {
	if (!mt(e)) return !1;
	let n = Tt(e, t);
	return n ? !xt(yt(n.program.body), e) : !1;
}
const Dt = i({
	create(e) {
		return {
			"Program:exit"() {
				let t = ut(e.sourceCode.getAllComments(), e.sourceCode);
				for (let n of t) {
					let t = n.value.trim();
					if (t === `}` || !Et(pt(t), e.filename)) continue;
					let r = n.comments.at(0),
						i = n.comments.at(-1);
					!r ||
						!i ||
						e.report({
							loc: { end: i.loc.end, start: r.loc.start },
							messageId: `commentedCode`,
							suggest: [
								{
									desc: `Remove this commented out code`,
									fix(e) {
										return e.removeRange([r.range[0], i.range[1]]);
									},
								},
							],
						});
				}
			},
		};
	},
	meta: {
		docs: { description: `Disallow commented-out code`, recommended: !1 },
		hasSuggestions: !0,
		messages: {
			commentedCode: `Commented-out code creates confusion about intent and clutters the codebase. Version control preserves history, making dead code comments unnecessary. Delete the commented code entirely. If needed later, retrieve it from git history.`,
		},
		schema: [],
		type: `suggestion`,
	},
});
function q(e) {
	return e.type === `Identifier` && (e.name === `it` || e.name === `test`);
}
function Ot(e) {
	if (e.callee.type !== `MemberExpression` || !q(e.callee.object)) return !1;
	let t = P(e.callee);
	return t === `only` || t === `skip`;
}
function kt(e) {
	return e.callee.type !== `MemberExpression` || !q(e.callee.object) ? !1 : P(e.callee) === `each`;
}
function At(e) {
	let t = e.arguments.at(-1);
	return t === void 0 || !x(t) ? void 0 : t;
}
function jt(e) {
	return (
		e.type === `DoWhileStatement` ||
		e.type === `ForInStatement` ||
		e.type === `ForOfStatement` ||
		e.type === `ForStatement` ||
		e.type === `WhileStatement`
	);
}
function Mt(e, t) {
	return e.type === t.type && e.range[0] === t.range[0] && e.range[1] === t.range[1];
}
function Nt(e, t) {
	return {
		hasCallback: e.hasCallback || t.hasCallback,
		hasIndeterminate: e.hasIndeterminate || t.hasIndeterminate,
		hasLoop: e.hasLoop || t.hasLoop,
	};
}
function Pt(e, t) {
	if (Mt(e, t)) return { hasCallback: !1, hasIndeterminate: !1, hasLoop: !1 };
	let n = {
		hasCallback: x(e),
		hasIndeterminate:
			x(e) ||
			jt(e) ||
			e.type === `ConditionalExpression` ||
			e.type === `IfStatement` ||
			e.type === `SwitchCase` ||
			e.type === `TryStatement`,
		hasLoop: jt(e),
	};
	return e.parent === null ? n : Nt(n, Pt(e.parent, t));
}
function Ft(e) {
	return e.callee.type === `Identifier`
		? q(e.callee)
		: Ot(e)
			? !0
			: e.callee.type === `CallExpression`
				? kt(e.callee)
				: !1;
}
function It(e) {
	return Ft(e) ? At(e) : void 0;
}
function Lt(e, t = []) {
	return e.callee.type === `Identifier` && (e.callee.name === `expect` || t.includes(e.callee.name));
}
function Rt({ callee: e }) {
	return e.type !== `MemberExpression` || e.object.type !== `Identifier` || e.object.name !== `expect`
		? !1
		: P(e) === `assertions`;
}
function zt({ callee: e }) {
	return e.type !== `MemberExpression` || e.object.type !== `Identifier` || e.object.name !== `expect`
		? !1
		: P(e) === `hasAssertions`;
}
function Bt(e, t = []) {
	let n = 0,
		r = !1,
		i = !1,
		a = !1,
		o = 0;
	return (
		Oe(e, function (s) {
			if (s.type !== `CallExpression` || !Lt(s, t)) return;
			let c = Pt(s.parent, e);
			if ((c.hasLoop && (i = !0), c.hasCallback && (r = !0), c.hasIndeterminate)) {
				((a = !0), (o += 1));
				return;
			}
			n += 1;
		}),
		{ deterministic: n, hasExpectInCallback: r, hasExpectInLoop: i, hasIndeterminate: a, indeterminate: o }
	);
}
function Vt(e) {
	return c(e)
		? {
				additionalExpectCallNames: Array.isArray(e.additionalExpectCallNames)
					? e.additionalExpectCallNames.filter((e) => typeof e == `string`)
					: [],
				onlyFunctionsWithAsyncKeyword: e.onlyFunctionsWithAsyncKeyword === !0,
				onlyFunctionsWithExpectInCallback: e.onlyFunctionsWithExpectInCallback === !0,
				onlyFunctionsWithExpectInLoop: e.onlyFunctionsWithExpectInLoop === !0,
			}
		: {
				additionalExpectCallNames: [],
				onlyFunctionsWithAsyncKeyword: !1,
				onlyFunctionsWithExpectInCallback: !1,
				onlyFunctionsWithExpectInLoop: !1,
			};
}
function Ht(e) {
	return e.onlyFunctionsWithAsyncKeyword || e.onlyFunctionsWithExpectInCallback || e.onlyFunctionsWithExpectInLoop;
}
function Ut(e) {
	return e.body ?? void 0;
}
function Wt(e) {
	let t = Ut(e);
	return t?.type === `BlockStatement` ? t : void 0;
}
function Gt(e, t, n, r, i, a) {
	return n + r === 0
		? !1
		: !Ht(t) ||
				(t.onlyFunctionsWithAsyncKeyword && e.async) ||
				(t.onlyFunctionsWithExpectInCallback && i) ||
				(t.onlyFunctionsWithExpectInLoop && a);
}
function Kt(e) {
	let t = Wt(e);
	if (t === void 0) return;
	let [n] = t.body;
	if (!(n?.type !== `ExpressionStatement` || n.expression.type !== `CallExpression`)) return n.expression;
}
function qt(e, t, n, r, i) {
	let a = Wt(t);
	if (a === void 0) {
		e.report({ messageId: `haveExpectAssertions`, node: n });
		return;
	}
	let [o] = a.body;
	if (i) {
		e.report({
			messageId: `haveExpectAssertions`,
			node: n,
			suggest: [
				{
					fix(e) {
						return o === void 0
							? e.insertTextAfterRange([a.range[0], a.range[0] + 1], ` expect.hasAssertions();`)
							: e.insertTextBefore(
									o,
									`expect.hasAssertions();
`,
								);
					},
					messageId: `suggestAddingHasAssertions`,
				},
			],
		});
		return;
	}
	e.report({
		messageId: `haveExpectAssertions`,
		node: n,
		suggest: [
			{
				data: { count: String(r) },
				fix(e) {
					return o === void 0
						? e.insertTextAfterRange([a.range[0], a.range[0] + 1], ` expect.assertions(${r});`)
						: e.insertTextBefore(o, `expect.assertions(${r});\n`);
				},
				messageId: `suggestAddingAssertions`,
			},
		],
	});
}
function Jt(e, t, n, r) {
	if (zt(t)) {
		t.arguments.length > 0 && e.report({ messageId: `hasAssertionsTakesNoArguments`, node: t });
		return;
	}
	if (!Rt(t)) return;
	if (t.arguments.length !== 1) {
		e.report({ messageId: `assertionsRequiresOneArgument`, node: t });
		return;
	}
	let [i] = t.arguments;
	if (i === void 0 || i.type === `SpreadElement` || !ee(i)) {
		e.report({ messageId: `assertionsRequiresNumberArgument`, node: t });
		return;
	}
	!r &&
		n > 0 &&
		i.value !== n &&
		e.report({ data: { actual: String(n), expected: String(i.value) }, messageId: `wrongAssertionCount`, node: t });
}
const Yt = i({
		create(e) {
			let t = Vt(e.options[0]);
			return {
				CallExpression(n) {
					if (!Ft(n)) return;
					let r = It(n);
					if (r === void 0) return;
					let i = Ut(r);
					if (i === void 0) return;
					let {
						deterministic: a,
						indeterminate: o,
						hasIndeterminate: s,
						hasExpectInCallback: c,
						hasExpectInLoop: l,
					} = Bt(i, t.additionalExpectCallNames);
					if (!Gt(r, t, a, o, c, l)) return;
					let u = Kt(r);
					if (u !== void 0 && (Rt(u) || zt(u))) {
						Jt(e, u, a, s);
						return;
					}
					qt(e, r, n, a, s);
				},
			};
		},
		meta: {
			docs: { description: `Enforce expect assertion guards in Jest tests.`, recommended: !0 },
			hasSuggestions: !0,
			messages: {
				assertionsRequiresNumberArgument: `This argument should be a number`,
				assertionsRequiresOneArgument: "`expect.assertions` expects a single argument of type number",
				hasAssertionsTakesNoArguments: "`expect.hasAssertions` expects no arguments",
				haveExpectAssertions:
					"Every test should have either `expect.assertions(<number of assertions>)` or `expect.hasAssertions()` as its first expression",
				suggestAddingAssertions: "Add `expect.assertions({{count}})`",
				suggestAddingHasAssertions: "Add `expect.hasAssertions()`",
				wrongAssertionCount: `Expected {{expected}} assertions, but test has {{actual}} expect calls`,
			},
			schema: [
				{
					additionalProperties: !1,
					properties: {
						additionalExpectCallNames: { items: { type: `string` }, type: `array` },
						onlyFunctionsWithAsyncKeyword: { type: `boolean` },
						onlyFunctionsWithExpectInCallback: { type: `boolean` },
						onlyFunctionsWithExpectInLoop: { type: `boolean` },
					},
					type: `object`,
				},
			],
			type: `suggestion`,
		},
	}),
	Xt = /[A-Z]+(?![a-z])|[A-Z]?[a-z]+|\d+/gv,
	Zt = /^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/gv,
	Qt = /([a-z0-9])([A-Z])/gv,
	$t = /[_\-\s]+/gv;
function en(e) {
	return e.replaceAll(Zt, ``).replaceAll(Qt, `$1 $2`).replaceAll($t, ` `).match(Xt) ?? [];
}
function tn(e) {
	let t = en(e),
		n = ``;
	for (let e of t) e.length !== 0 && (n += `${e.slice(0, 1).toUpperCase()}${e.slice(1).toLowerCase()}`);
	return n;
}
const nn = /^\d/u;
function rn({ id: e }) {
	if (e.type === `Identifier`) return e.name;
	if (!(e.type !== `Literal` || typeof e.value != `string`)) return nn.test(e.value) ? void 0 : e.value;
}
const an = i({
		create(e) {
			return {
				TSEnumDeclaration(t) {
					let n = t.id.name;
					tn(n) !== n && e.report({ data: { identifier: n }, messageId: `notPascalCase`, node: t.id });
				},
				TSEnumMember(t) {
					let n = rn(t);
					n === void 0 ||
						tn(n) === n ||
						e.report({ data: { identifier: n }, messageId: `notPascalCase`, node: t.id });
				},
			};
		},
		meta: {
			docs: { description: `Enforce Pascal case when naming enums.`, recommended: !0 },
			messages: {
				notPascalCase: `Enum '{{ identifier }}' uses non-standard casing. TypeScript convention requires PascalCase for enum names and members to distinguish them from variables (camelCase) and constants (UPPER_CASE). Rename to PascalCase: capitalize first letter of each word, no underscores.`,
			},
			schema: [],
			type: `suggestion`,
		},
	}),
	on = new Set([
		`alumni`,
		`axes`,
		`cacti`,
		`children`,
		`criteria`,
		`data`,
		`dice`,
		`feet`,
		`fungi`,
		`geese`,
		`indices`,
		`matrices`,
		`media`,
		`men`,
		`mice`,
		`octopi`,
		`people`,
		`phenomena`,
		`teeth`,
		`vertices`,
		`women`,
	]),
	sn = new Set([
		`alias`,
		`analysis`,
		`axis`,
		`basis`,
		`business`,
		`class`,
		`crisis`,
		`glass`,
		`news`,
		`series`,
		`species`,
		`status`,
		`thesis`,
	]),
	cn = new Set([
		`args`,
		`components`,
		`controllers`,
		`dto`,
		`dtos`,
		`entries`,
		`enums`,
		`hooks`,
		`items`,
		`keys`,
		`models`,
		`options`,
		`orders`,
		`pages`,
		`parameters`,
		`params`,
		`props`,
		`repositories`,
		`services`,
		`settings`,
		`types`,
		`values`,
		`vo`,
		`vos`,
	]),
	ln = /[A-Z]+(?![a-z])|[A-Z]?[a-z]+|\d+/gv,
	un = /^[A-Z]{2,}[sS]?$/v;
function dn(e) {
	let t = [],
		n = 0;
	for (let r of e.split(`_`)) {
		let e = r.match(ln);
		if (e !== null) for (let r of e) t[n++] = r;
	}
	return t;
}
const fn = /^\d+$/v;
function pn(e) {
	for (let t = e.length - 1; t >= 0; --t) {
		let n = e[t];
		if (!(n === void 0 || fn.test(n))) return { lowercased: n.toLowerCase(), original: n };
	}
}
const mn = /[sS]$/v,
	hn = /(ches|shes|xes|zes)$/v;
function gn(e, t) {
	return on.has(e) || cn.has(e)
		? !0
		: sn.has(e)
			? !1
			: (un.test(t) && mn.test(t)) ||
				e.endsWith(`ies`) ||
				e.endsWith(`ves`) ||
				hn.test(e) ||
				(e.endsWith(`s`) && !e.endsWith(`ss`) && !e.endsWith(`us`) && !e.endsWith(`is`));
}
function _n(e) {
	if (un.test(e) && mn.test(e)) return !0;
	let t = pn(dn(e));
	return t !== void 0 && gn(t.lowercased, t.original);
}
const vn = i({
		create(e) {
			return {
				TSEnumDeclaration({ id: t }) {
					let { name: n } = t;
					_n(n) && e.report({ data: { name: n }, messageId: `notSingular`, node: t });
				},
			};
		},
		meta: {
			docs: { description: `Prefer singular naming for enums.`, recommended: !0 },
			messages: { notSingular: `Enum name "{{name}}" should be singular.` },
			schema: [],
			type: `suggestion`,
		},
	}),
	yn = `replace`,
	bn = `suggestion`,
	xn = `A more descriptive name will do too.`,
	Sn = { args: `parameters`, char: `character`, dt: `deltaTime`, plr: `player` },
	Cn = [`char`],
	wn = {
		acc: { accumulator: !0 },
		arg: { argument: !0 },
		args: { arguments: !0 },
		arr: { array: !0 },
		attr: { attribute: !0 },
		attrs: { attributes: !0 },
		btn: { button: !0 },
		cb: { callback: !0 },
		char: { character: !0 },
		conf: { config: !0 },
		ctx: { context: !0 },
		cur: { current: !0 },
		curr: { current: !0 },
		db: { database: !0 },
		def: { defer: !0, deferred: !0, define: !0, definition: !0 },
		dest: { destination: !0 },
		dev: { development: !0 },
		dir: { direction: !0, directory: !0 },
		dirs: { directories: !0 },
		dist: { distance: !0 },
		doc: { document: !0 },
		docs: { documentation: !0, documents: !0 },
		dst: { daylightSavingTime: !0, destination: !0, distribution: !0 },
		dt: { dateTime: !0, deltaTime: !0 },
		e: { error: !0, event: !0 },
		el: { element: !0 },
		elem: { element: !0 },
		elems: { elements: !0 },
		env: { environment: !0 },
		envs: { environments: !0 },
		err: { error: !0 },
		ev: { event: !0 },
		evt: { event: !0 },
		ext: { extension: !0 },
		exts: { extensions: !0 },
		fn: { func: !0, function: !0 },
		func: { function: !0 },
		i: { index: !0 },
		idx: { index: !0 },
		impl: { implementation: !0 },
		j: { index: !0 },
		len: { length: !0 },
		lib: { library: !0 },
		mod: { module: !0 },
		msg: { message: !0 },
		num: { number: !0 },
		obj: { object: !0 },
		opts: { options: !0 },
		param: { parameter: !0 },
		params: { parameters: !0 },
		pkg: { package: !0 },
		plr: { player: !0 },
		prev: { previous: !0 },
		prod: { production: !0 },
		prop: { property: !0 },
		props: { properties: !0 },
		rel: { related: !0, relationship: !0, relative: !0 },
		req: { request: !0 },
		res: { resource: !0, response: !0, result: !0 },
		ret: { returnValue: !0 },
		retval: { returnValue: !0 },
		sep: { separator: !0 },
		src: { source: !0 },
		stdDev: { standardDeviation: !0 },
		str: { string: !0 },
		tbl: { table: !0 },
		temp: { temporary: !0 },
		tit: { title: !0 },
		tmp: { temporary: !0 },
		util: { utility: !0 },
		utils: { utilities: !0 },
		val: { value: !0 },
		var: { variable: !0 },
		vars: { variables: !0 },
		ver: { version: !0 },
	},
	Tn = {
		defaultProps: !0,
		devDependencies: !0,
		EmberENV: !0,
		getDerivedStateFromProps: !0,
		getInitialProps: !0,
		getServerSideProps: !0,
		getStaticProps: !0,
		iOS: !0,
		obj: !0,
		propTypes: !0,
		setupFilesAfterEnv: !0,
	},
	En = [`i18n`, `l10n`],
	Dn = /(?=[A-Z])|(?<=[_.-])/u,
	On = new Set(
		`any.as.boolean.break.case.catch.class.const.constructor.continue.debugger.declare.default.delete.do.else.enum.export.extends.false.finally.for.from.function.get.if.implements.import.in.instanceof.interface.let.module.new.null.number.of.package.private.protected.public.require.return.set.static.string.super.switch.symbol.this.throw.true.try.type.typeof.var.void.while.with.yield`.split(
			`.`,
		),
	),
	kn = /^[A-Za-z]+$/u;
function An(e) {
	return (e >= 65 && e <= 90) || (e >= 97 && e <= 122) || e === 36 || e === 95;
}
function jn(e) {
	return e < 192
		? An(e)
		: e >= 12289 && e <= 55295
			? !0
			: e <= 767
				? e !== 215 && e !== 247
				: e <= 8191
					? e >= 880 && e !== 894
					: e <= 8591
						? (e >= 8204 && e <= 8205) || e >= 8304
						: e <= 12271
							? e >= 11264
							: e <= 64255
								? e >= 63744
								: e <= 65023
									? e >= 64512
									: e <= 65279
										? e >= 65136
										: e <= 65370
											? (e >= 65313 && e <= 65338) || e >= 65345
											: e >= 65382 && e <= 65500;
}
function Mn(e) {
	return !!(
		jn(e) ||
		(e >= 48 && e <= 57) ||
		e === 8204 ||
		e === 8205 ||
		(e >= 768 && e <= 865) ||
		(e >= 8240 && e <= 8266)
	);
}
function J(e) {
	if (e.length === 0 || On.has(e)) return !1;
	let t = e.codePointAt(0);
	if (t === void 0 || !jn(t)) return !1;
	let n = t > 65535 ? 2 : 1;
	for (; n < e.length; ) {
		let t = e.codePointAt(n);
		if (t === void 0 || !Mn(t)) return !1;
		n += t > 65535 ? 2 : 1;
	}
	return !0;
}
const Nn = /(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])|(?<=[a-zA-Z])(?=\d)|(?<=\d)(?=[a-zA-Z])/u,
	Pn = /[.+^${}()|[\]\\]/gu,
	Fn = n(`^/(?<first>.+)/(?<second>[gimsuy]*)$`, `v`);
function Y(e) {
	return e === e.toUpperCase();
}
function In(e) {
	return Y(e.charAt(0));
}
function Ln(e) {
	return e.charAt(0).toUpperCase() + e.slice(1);
}
function Rn(e) {
	return e.charAt(0).toLowerCase() + e.slice(1);
}
function zn(e) {
	return e.split(Nn);
}
function Bn(e) {
	let t = e.match(/\$(\d+)/gu);
	if (t === null) return 0;
	let n = 0;
	for (let e of t) {
		let t = Number.parseInt(e.slice(1), 10);
		t > n && (n = t);
	}
	return n;
}
function Vn(e) {
	let t = Bn(e);
	if (t === 0) return [];
	let n = Array(t);
	for (let e = 1; e <= t; e += 1) n[e - 1] = RegExp(`\\$${e}`, `gu`);
	return n;
}
function Hn(e, t) {
	if (e.startsWith(`/`)) {
		let n = Fn.exec(e);
		if (n?.groups !== void 0)
			return {
				matcher: {
					original: e,
					pattern: RegExp(`^${n.groups.first}$`, n.groups.second),
					replacement: t,
					replacementPatterns: Vn(t),
				},
				type: `pattern`,
			};
	}
	if (e.includes(`*`) || e.includes(`?`)) {
		let n = e
				.replaceAll(Pn, String.raw`\$&`)
				.replaceAll(`*`, `(.*)`)
				.replaceAll(`?`, `(.)`),
			r = 0,
			i = t.replaceAll(`*`, () => `$${++r}`);
		return {
			matcher: { original: e, pattern: RegExp(`^${n}$`, `u`), replacement: i, replacementPatterns: Vn(i) },
			type: `pattern`,
		};
	}
	return { original: e, replacement: t, type: `exact` };
}
function Un(e, t) {
	let n = t.exactMatchers.get(e);
	if (n !== void 0) return { matchedWord: e, replacement: n, shorthand: e };
	for (let n of t.matchers) {
		let t = e.match(n.pattern);
		if (t === null) continue;
		let r = n.replacement,
			i = 1;
		for (let e of n.replacementPatterns) ((r = r.replaceAll(e, t[i] ?? ``)), (i += 1));
		return { matchedWord: e, replacement: r, shorthand: n.original };
	}
}
function Wn(e, t) {
	if (t.ignoreExact.has(e)) return !0;
	for (let n of t.ignoreMatchers) if (n.pattern.test(e)) return !0;
	return !1;
}
function Gn(e, t) {
	return e === `internal` || typeof e == `boolean` ? e : t;
}
function Kn(e) {
	if (!c(e)) return;
	let t = {};
	for (let [n, r] of Object.entries(e)) typeof r == `boolean` && (t[n] = r);
	return t;
}
function X(e, t) {
	return typeof e == `boolean` ? e : t;
}
function qn(e) {
	let t = c(e) ? e : void 0,
		n = Kn(t?.allowList),
		r = X(t?.extendDefaultAllowList, !0) ? (n === void 0 ? Tn : { ...Tn, ...n }) : (n ?? {});
	return new Map(Object.entries(r));
}
function Jn(e) {
	if (!c(e)) return {};
	let t = {};
	for (let [n, r] of Object.entries(e)) {
		if (r === !1) {
			t[n] = !1;
			continue;
		}
		if (!c(r)) continue;
		let e = {};
		for (let [t, n] of Object.entries(r)) typeof n == `boolean` && (e[t] = n);
		t[n] = e;
	}
	return t;
}
function Yn(e) {
	let t = c(e) ? e : void 0,
		n = X(t?.extendDefaultReplacements, !0),
		r = Jn(t?.replacements),
		i = new Set([...Object.keys(wn), ...Object.keys(r)]),
		a = [];
	for (let e of i) {
		let t = r[e],
			i = n ? (wn[e] ?? {}) : {},
			o = t === !1 ? {} : t === void 0 ? i : { ...i, ...t };
		a.push([e, new Map(Object.entries(o))]);
	}
	return new Map(a);
}
function Xn(e) {
	let t = c(e) ? e : void 0,
		n = [];
	for (let e of En) n.push(e);
	if (Array.isArray(t?.ignore)) for (let e of t.ignore) (typeof e == `string` || e instanceof RegExp) && n.push(e);
	return n.map((e) => (e instanceof RegExp ? e : new RegExp(e, `u`)));
}
function Zn(e) {
	let t = c(e) ? e : void 0,
		n = new Set(Cn);
	if (!l(t?.allowPropertyAccess)) return n;
	for (let e of t.allowPropertyAccess) n.add(e);
	return n;
}
function Qn(e) {
	let t = c(e) ? e : void 0,
		n = new Map(),
		r = new Set(),
		i = [],
		a = [],
		o = u(t?.shorthands) ? t.shorthands : {},
		s = { ...Sn, ...o };
	for (let [e, t] of Object.entries(s)) {
		let r = Hn(e, t);
		r.type === `exact` ? n.set(r.original, r.replacement) : a.push(r.matcher);
	}
	if (l(t?.ignoreShorthands))
		for (let e of t.ignoreShorthands) {
			let t = Hn(e, ``);
			t.type === `exact` ? r.add(t.original) : i.push(t.matcher);
		}
	return { exactMatchers: n, ignoreExact: r, ignoreMatchers: i, matchers: a };
}
function $n(e) {
	let t = c(e) ? e : void 0;
	return {
		allowList: qn(t),
		allowPropertyAccess: Zn(t),
		checkDefaultAndNamespaceImports: Gn(t?.checkDefaultAndNamespaceImports, `internal`),
		checkFilenames: X(t?.checkFilenames, !0),
		checkProperties: X(t?.checkProperties, !1),
		checkShorthandImports: Gn(t?.checkShorthandImports, `internal`),
		checkShorthandProperties: X(t?.checkShorthandProperties, !0),
		checkVariables: X(t?.checkVariables, !0),
		ignore: Xn(t),
		replacements: Yn(t),
		shorthandConfiguration: Qn(t),
	};
}
function er(e, t) {
	if (Y(e) || t.allowList.get(e) === !0) return [];
	let n = t.replacements.get(Rn(e)) ?? t.replacements.get(e) ?? t.replacements.get(Ln(e));
	if (n === void 0) return [];
	let r = In(e) ? Ln : Rn,
		i = [...n.keys()].filter((e) => n.get(e) === !0).map(r);
	return i.length > 0 ? i.toSorted() : [];
}
function tr(e, t) {
	if (e.length === 0) return;
	let n = zn(e),
		r = [],
		i = !1;
	for (let e of n) {
		let n = Un(e, t);
		n !== void 0 && ((i = !0), r.push(n));
	}
	if (!i) return;
	let a = ``,
		o = 0;
	for (let e of n) {
		let t = r[o];
		if (t?.matchedWord === e) {
			((a += t.replacement), (o += 1));
			continue;
		}
		a += e;
	}
	return { matches: r, replaced: a };
}
function nr(e, t) {
	if (Wn(e, t)) return !0;
	let n = zn(e),
		r = !1;
	for (let e of n) {
		let n = Un(e, t);
		if (n !== void 0 && ((r = !0), !Wn(n.matchedWord, t))) return !1;
	}
	return r;
}
function rr(e, t, n) {
	if (n.has(e)) return !0;
	for (let e of t.matches) if (!n.has(e.matchedWord)) return !1;
	return t.matches.length > 0;
}
function Z(e, t, n = 3) {
	if (Y(e) || t.allowList.get(e) === !0 || t.ignore.some((t) => t.test(e))) return { total: 0 };
	let r = tr(e, t.shorthandConfiguration);
	if (r !== void 0) return nr(e, t.shorthandConfiguration) ? { total: 0 } : { samples: [r.replaced], total: 1 };
	let i = er(e, t);
	if (i.length > 0) return { samples: i.slice(0, n), total: i.length };
	let a = e.split(Dn).filter(Boolean),
		o = !1,
		s = [],
		c = 0;
	for (let e of a) {
		let n = er(e, t);
		if (n.length > 0) {
			((o = !0), (s[c++] = n));
			continue;
		}
		s[c++] = [e];
	}
	if (!o) return { total: 0 };
	let l = s.reduce((e, t) => e * t.length, 1),
		u = Math.min(l, n),
		d = Array.from({ length: u }, (e, t) => {
			let n = t,
				r = [];
			for (let e = s.length - 1; e >= 0; --e) {
				let t = s[e] ?? [],
					i = n % t.length;
				n = (n - i) / t.length;
				let a = t[i];
				a !== void 0 && r.unshift(a);
			}
			return r;
		});
	for (let e of d)
		for (let t = e.length - 1; t > 0; --t) {
			let n = e[t] ?? ``;
			kn.test(n) && e[t - 1]?.endsWith(n) === !0 && e.splice(t, 1);
		}
	return { samples: d.map((e) => e.join(``)), total: l };
}
function ir(e, t) {
	let n = t.replacements.get(e);
	if (n === void 0) return !1;
	for (let e of n.values()) if (e) return !0;
	return !1;
}
function Q(e, t, n) {
	let { samples: r = [], total: i } = t;
	if (i === 1) return { data: { discouragedName: e, nameTypeText: n, replacement: r[0] ?? `` }, messageId: yn };
	let a = r.map((e) => `\`${e}\``).join(`, `),
		o = i - r.length;
	return (
		o > 0 && (a += `, ... (${o > 99 ? `99+` : o} more omitted)`),
		{ data: { discouragedName: e, nameTypeText: n, replacementsText: a }, messageId: bn }
	);
}
function ar(e) {
	let t = [e],
		n = 1;
	for (let r of e.childScopes) {
		let e = ar(r);
		for (let r of e) t[n++] = r;
	}
	return t;
}
function or(e, t) {
	let n = t;
	for (; n !== null; ) {
		let t = n.set.get(e);
		if (t !== void 0) return t;
		n = n.upper;
	}
}
function sr(e, t) {
	return !t.some((t) => or(e, t) !== void 0);
}
function cr(e, t, n = () => !0) {
	let r = e;
	if (!(!J(r) && ((r = `${r}_`), !J(r)))) {
		for (; !sr(r, t) || !n(r, t); ) r = `${r}_`;
		return r;
	}
}
function lr(e) {
	let t = new Set();
	for (let n of e.identifiers) t.add(n);
	for (let { identifier: n } of e.references) t.add(n);
	return [...t];
}
function $(e, t) {
	return e.range[0] === t.range[0] && e.range[1] === t.range[1];
}
function ur(e) {
	let { parent: t } = e;
	return !xe(t) || t.local !== e ? !1 : $(t.local, t.imported);
}
function dr(e) {
	let { parent: t } = e;
	return !O(t) || t.local !== e ? !1 : $(t.local, t.exported);
}
function fr(e) {
	if (!E(e)) return !1;
	let { parent: t } = e;
	return A(t) && t.shorthand && t.value === e;
}
function pr(e) {
	if (!E(e)) return !1;
	let { parent: t } = e;
	if (!T(t) || t.left !== e) return !1;
	let n = t.parent;
	return A(n) ? n.shorthand : !1;
}
function mr(e) {
	if (!E(e)) return !1;
	let { parent: t } = e;
	if ((ye(t) && t.local === e) || (be(t) && t.local === e)) return !0;
	if (xe(t) && t.local === e) {
		let { imported: e } = t;
		if (k(e) && e.name === `default`) return !0;
	}
	return v(t) && t.id === e && t.init !== null && M(t.init);
}
function hr(e) {
	if (!E(e)) return !1;
	let { parent: t } = e;
	if (v(t) && t.id === e) {
		let e = t.parent;
		return C(e) ? D(e.parent) : !1;
	}
	return (w(t) && t.id === e) || (oe(t) && t.id === e) || (Te(t) && t.id === e) ? D(t.parent) : !1;
}
function gr(e) {
	return lr(e).every((e) => !hr(e) && !Se(e));
}
function _r(e, t, n) {
	if (E(e))
		return fr(e) || pr(e)
			? n.replaceText(e, `${e.name}: ${t}`)
			: ur(e)
				? n.replaceText(e, `${e.name} as ${t}`)
				: dr(e)
					? n.replaceText(e, `${t} as ${e.name}`)
					: n.replaceText(e, t);
}
function vr(e, t, n) {
	let r = [],
		i = 0;
	for (let a of lr(e)) {
		let e = _r(a, t, n);
		e !== void 0 && (r[i++] = e);
	}
	return r;
}
function yr(e) {
	if (!E(e)) return !1;
	let { parent: t } = e;
	if (y(t) && t.property === e && !t.computed) {
		let e = t.parent;
		if (_e(e) && e.left === t) return !0;
	}
	return (A(t) && t.key === e && !t.computed && !t.shorthand && we(t.parent)) ||
		(O(t) && t.exported === e && t.local !== e)
		? !0
		: (Ce(t) || S(t)) && t.key === e && !t.computed;
}
function br(e) {
	if (!E(e)) return !1;
	let { parent: t } = e;
	return A(t) && t.key === e && !t.computed && !t.shorthand && we(t.parent);
}
function xr(e) {
	if (e.type === `ImportBinding`) {
		let { parent: t } = e;
		if (t !== null && ve(t) && j(t.source)) return t.source.value;
	}
	if (e.type === `Variable`) {
		let { node: t } = e;
		if (v(t) && t.init !== null && M(t.init)) {
			let [e] = t.init.arguments;
			if (e !== void 0 && j(e)) return e.value;
		}
	}
}
function Sr(e) {
	let t = xr(e);
	return t === void 0 ? !1 : !t.includes(`node_modules`) && (t.startsWith(`.`) || t.startsWith(`/`));
}
function Cr(e, t) {
	return e === !1 ? !1 : e === `internal` ? Sr(t) : !0;
}
function wr(e) {
	return e.defs.length === 1 ? e.defs[0]?.type === `ClassName` : !1;
}
const Tr = [
	{
		additionalProperties: !1,
		properties: {
			allowList: { additionalProperties: { type: `boolean` }, type: `object` },
			allowPropertyAccess: { items: { type: `string` }, type: `array` },
			checkDefaultAndNamespaceImports: { enum: [!1, !0, `internal`] },
			checkFilenames: { type: `boolean` },
			checkProperties: { type: `boolean` },
			checkShorthandImports: { enum: [!1, !0, `internal`] },
			checkShorthandProperties: { type: `boolean` },
			checkVariables: { type: `boolean` },
			extendDefaultAllowList: { type: `boolean` },
			extendDefaultReplacements: { type: `boolean` },
			ignore: { items: { oneOf: [{ type: `object` }, { type: `string` }] }, type: `array` },
			ignoreShorthands: { items: { type: `string` }, type: `array` },
			replacements: {
				additionalProperties: {
					oneOf: [{ enum: [!1] }, { additionalProperties: { type: `boolean` }, type: `object` }],
				},
				type: `object`,
			},
			shorthands: { additionalProperties: { type: `string` }, type: `object` },
		},
		type: `object`,
	},
];
function Er(e) {
	return function (t, n) {
		return n.every((n) => {
			let r = e.get(n);
			return r === void 0 || !r.has(t);
		});
	};
}
function Dr(e) {
	let { parent: t } = e;
	return (y(t) && t.property === e && !t.computed) || (Ee(t) && t.right === e);
}
function Or(e, t, n, r) {
	let i = [];
	((i[0] = t), r({ ...Q(e.name, { samples: i, total: 1 }, n ? `property` : `variable`), node: e }));
}
function kr(e, t, n) {
	return (mr(t) && !Cr(n.checkDefaultAndNamespaceImports, e)) || (ur(t) && !Cr(n.checkShorthandImports, e))
		? !0
		: !n.checkShorthandProperties && fr(t);
}
function Ar(e) {
	if (e.name !== `plr`) return;
	let [t] = e.defs;
	if (t?.type !== `Variable` || !v(t.node) || t.node.init === null) return;
	let { init: n } = t.node;
	if (
		y(n) &&
		!n.computed &&
		k(n.object) &&
		n.object.name === `Players` &&
		k(n.property) &&
		n.property.name === `LocalPlayer`
	)
		return `localPlayer`;
}
function jr(e, t, n, r) {
	let i = [],
		a = 0,
		o = 0;
	for (let s of e) {
		let e = cr(s, t, n);
		if (e !== void 0) {
			if (e !== s && ir(s, r)) {
				o += 1;
				continue;
			}
			e.length > 0 && (i[a++] = e);
		}
	}
	return { droppedDiscouraged: o, safeSamples: i };
}
function Mr(e, t, n) {
	let r = e.type === `Variable` && v(e.node) && e.node.init === null,
		i = e.type === `Parameter` && t.scope.type === `function` && t.scope.block.type === `ArrowFunctionExpression`,
		a = r || i;
	return (e, t) => !(!n(e, t) || (a && e === `arguments`));
}
function Nr(e, t, n, r, i, a, o) {
	for (let e of i) (a.has(e) || a.set(e, new Set()), a.get(e)?.add(r));
	e({
		...t,
		fix(e) {
			return vr(n, r, e);
		},
		node: o,
	});
}
function Pr(e, t, n, r, i) {
	let [a] = e.defs;
	if (a === void 0) return;
	let o = a.name;
	if (!k(o) || kr(a, o, t)) return;
	let s = Mr(a, e, r),
		c = Ar(e),
		l = c === void 0 ? Z(e.name, t) : { samples: [c], total: 1 };
	if (l.total === 0 || !l.samples) return;
	let { references: u } = e,
		d = [...u.map((e) => e.from), e.scope],
		{ droppedDiscouraged: f, safeSamples: p } = jr(l.samples, d, s, t),
		m = p.length > 0 ? p : l.samples,
		h = typeof l.samples.length == `number` && l.samples.length === l.total ? Math.max(0, l.total - f) : l.total,
		g = e.name === `fn` && h > 1 ? m.map((e) => (e === `function_` ? `function` : e)) : m,
		_ = Q(o.name, { samples: g, total: h }, `variable`);
	if (h === 1 && p.length === 1 && gr(e)) {
		let [t] = p;
		if (t !== void 0) {
			Nr(i, _, e, t, d, n, o);
			return;
		}
	}
	i({ ..._, node: o });
}
function Fr(e, t) {
	if (!wr(e)) {
		t(e);
		return;
	}
	if (e.scope.type === `class`) {
		let [n] = e.defs;
		if (n === void 0) {
			t(e);
			return;
		}
		let r = n.name;
		if (!k(r)) {
			t(e);
			return;
		}
		t(e);
	}
}
function Ir(e, t) {
	for (let n of ar(e)) for (let e of n.variables) Fr(e, t);
}
const Lr = i({
	create(e) {
		let t = $n(e.options[0]),
			n = e.physicalFilename,
			r = new WeakMap(),
			i = Er(r),
			{ sourceCode: a } = e;
		function o(n) {
			Pr(n, t, r, i, e.report);
		}
		return {
			Identifier(n) {
				if (!E(n) || n.name === `__proto__`) return;
				let r = tr(n.name, t.shorthandConfiguration),
					i = yr(n),
					a = Dr(n);
				if (r !== void 0 && (i || a)) {
					if (
						nr(n.name, t.shorthandConfiguration) ||
						!t.checkShorthandProperties ||
						(a && rr(n.name, r, t.allowPropertyAccess))
					)
						return;
					Or(n, r.replaced, !0, e.report);
					return;
				}
				if (!t.checkProperties) return;
				let o = Z(n.name, t);
				if (o.total === 0 || !i) return;
				let s = Q(n.name, o, `property`);
				if (o.total === 1 && o.samples && br(n)) {
					let [t] = o.samples,
						{ parent: r } = n;
					if (t !== void 0 && A(r) && j(r.value) && J(t)) {
						e.report({
							...s,
							fix(e) {
								return e.replaceText(n, t);
							},
							node: n,
						});
						return;
					}
				}
				e.report({ ...s, node: n });
			},
			JSXOpeningElement({ name: n }) {
				if (!t.checkVariables || !Se(n) || !In(n.name)) return;
				let r = Z(n.name, t);
				if (r.total === 0) return;
				let i = Q(n.name, r, `variable`);
				e.report({ ...i, node: n });
			},
			"Program:exit"(r) {
				if (t.checkFilenames && n !== `<input>` && n !== `<text>`) {
					let i = Math.max(n.lastIndexOf(`/`), n.lastIndexOf(`\\`)),
						a = n.slice(i + 1),
						o = a.lastIndexOf(`.`),
						s = o === -1 ? `` : a.slice(o),
						c = Z(o === -1 ? a : a.slice(0, o), t);
					if (c.total > 0 && c.samples) {
						let t = c.samples.map((e) => `${e}${s}`);
						e.report({ ...Q(a, { samples: t, total: c.total }, `filename`), node: r });
					}
				}
				t.checkVariables && Ir(a.getScope(r), o);
			},
		};
	},
	meta: {
		docs: { description: `Prevent abbreviations.`, recommended: !1 },
		fixable: `code`,
		messages: {
			[yn]: `The {{nameTypeText}} \`{{discouragedName}}\` should be named \`{{replacement}}\`. ${xn}`,
			[bn]: `Please rename the {{nameTypeText}} \`{{discouragedName}}\`. Suggested names are: {{replacementsText}}. ${xn}`,
		},
		schema: Tr,
		type: `suggestion`,
	},
});
function Rr(e) {
	return c(e) && e.metric === `statements` ? `statements` : `lines`;
}
function zr(e, t) {
	let n = e.consequent.length;
	if (n === 0) return !1;
	let [r] = e.consequent;
	if (r === void 0 || (n === 1 && r.type === `BlockStatement`)) return !1;
	if (t === `statements`) return n > 1;
	let i = e.consequent[n - 1];
	return i === void 0 ? !1 : r.loc.start.line !== i.loc.end.line;
}
const Br = i({
	create(e) {
		let t = Rr(e.options[0]);
		return {
			SwitchCase(n) {
				if (!zr(n, t)) return;
				let [r] = n.consequent,
					i = n.consequent.at(-1);
				r === void 0 ||
					i === void 0 ||
					e.report({
						fix(e) {
							return [
								e.insertTextBefore(
									r,
									`{
`,
								),
								e.insertTextAfter(
									i,
									`
}`,
								),
							];
						},
						messageId: `wrapCaseBody`,
						node: r,
					});
			},
		};
	},
	meta: {
		docs: { description: `Require braces around switch case bodies that span multiple lines.` },
		fixable: `code`,
		messages: { wrapCaseBody: `Wrap this switch case body in braces.` },
		schema: [
			{
				additionalProperties: !1,
				properties: { metric: { default: `lines`, enum: [`lines`, `statements`], type: `string` } },
				type: `object`,
			},
		],
		type: `problem`,
	},
});
function Vr(e) {
	return e.includes(`u`) || e.includes(`v`);
}
function Hr(e, t) {
	return k(e) && e.name === t;
}
function Ur(e) {
	if (!(e.type !== `Literal` || typeof e.value != `string`)) return e.value;
}
function Wr(e) {
	return e.type !== `SpreadElement`;
}
const Gr = r({
	meta: { name: `small-rules` },
	rules: {
		"array-type-generic": s,
		"ban-types": m,
		"no-array-constructor-elements": Ie,
		"no-array-size-assignment": Be,
		"no-commented-code": Dt,
		"prefer-expect-assertions": Yt,
		"prefer-pascal-case-enums": an,
		"prefer-singular-enums": vn,
		"prevent-abbreviations": Lr,
		"require-switch-case-braces": Br,
		"require-unicode-regex": i({
			create(e) {
				return {
					CallExpression(t) {
						if (!Hr(t.callee, `regex`)) return;
						if (t.arguments.length < 2) {
							e.report({ messageId: `requireUnicodeFlag`, node: t });
							return;
						}
						let [, n] = t.arguments;
						if (n === void 0 || !Wr(n)) return;
						let r = Ur(n);
						r !== void 0 && !Vr(r) && e.report({ messageId: `requireUnicodeFlag`, node: t });
					},
				};
			},
			meta: {
				docs: { description: `Require the 'u' or 'v' unicode flag on arktype regex() calls.` },
				messages: {
					requireUnicodeFlag: `Missing the 'u' or 'v' unicode flag on this regex() call. Use the unicode flag to avoid silently creating invalid regex patterns.`,
				},
				schema: [],
				type: `problem`,
			},
		}),
	},
});
export { Gr as default };
