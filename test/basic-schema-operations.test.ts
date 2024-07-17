import { describe, expect } from "@effect/vitest";
import { Array, Effect, Exit, String } from "effect";

import { test } from "~/test/convex-effect-test";
import { api } from "~/test/convex/_generated/api";
import type { Id } from "~/test/convex/_generated/dataModel";
import {
	type TableName,
	tableName,
} from "~/test/convex/schemas/basic_schema_operations";
import { TestConvexService } from "~/test/test-convex-service";
import { NotUniqueError } from "../src/database";

test("queryGet", () =>
	Effect.gen(function* () {
		const c = yield* TestConvexService;

		const text = "Hello world!";

		const noteId = yield* c.run(({ db }) =>
			db.insert(tableName("notes"), { text }),
		);

		const note = yield* c.query(api.basic_schema_operations.queryGet, {
			noteId,
		});

		expect(note?.text).toEqual(text);
	}));

test("mutationGet", () =>
	Effect.gen(function* () {
		const c = yield* TestConvexService;

		const text = "Hello world!";

		const noteId = yield* c.run(({ db }) =>
			db.insert(tableName("notes"), { text }),
		);

		const note = yield* c.mutation(api.basic_schema_operations.mutationGet, {
			noteId,
		});

		expect(note?.text).toEqual(text);
	}));

test("insert", () =>
	Effect.gen(function* () {
		const c = yield* TestConvexService;

		const text = "Hello, world!";

		const noteId: Id<TableName<"notes">> = yield* c.mutation(
			api.basic_schema_operations.insert,
			{
				text,
			},
		);

		const note = yield* c.run(({ db }) => db.get(noteId));

		expect(note?.text).toEqual(text);
	}));

test("queryCollect", () =>
	Effect.gen(function* () {
		const c = yield* TestConvexService;

		const text = "Hello, world!";

		yield* c.run(({ db }) => db.insert(tableName("notes"), { text }));

		const notes = yield* c.query(api.basic_schema_operations.queryCollect, {});

		expect(notes.length).toEqual(1);
		expect(notes[0]?.text).toEqual(text);
	}));

test("mutationCollect", () =>
	Effect.gen(function* () {
		const c = yield* TestConvexService;

		const text = "Hello, world!";

		yield* c.run(({ db }) => db.insert(tableName("notes"), { text }));

		const notes = yield* c.mutation(
			api.basic_schema_operations.mutationCollect,
			{},
		);

		expect(notes.length).toEqual(1);
		expect(notes[0]?.text).toEqual(text);
	}));

test("filter + first", () =>
	Effect.gen(function* () {
		const c = yield* TestConvexService;

		const text1 = "Hello, Earth!";
		const text2 = "Hello, Mars!";

		yield* c.run(({ db }) =>
			Promise.all([
				db.insert(tableName("notes"), { text: text1 }),
				db.insert(tableName("notes"), { text: text2 }),
			]),
		);

		const note = yield* c.query(api.basic_schema_operations.filterFirst, {
			text: text1,
		});

		expect(note?.text).toEqual(text1);
	}));

test("withIndex + first", () =>
	Effect.gen(function* () {
		const c = yield* TestConvexService;

		const text = "Hello, world!";

		yield* c.run(({ db }) =>
			db.insert(tableName("notes"), {
				text: text,
			}),
		);

		const note = yield* c.query(api.basic_schema_operations.withIndexFirst, {
			text: text,
		});

		expect(note?.text).toEqual(text);
	}));

test("order desc + collect", () =>
	Effect.gen(function* () {
		const c = yield* TestConvexService;

		const firstText = "A";
		const secondText = "B";
		const thirdText = "C";

		yield* c.run(({ db }) =>
			Promise.all([
				// Insert in reverse of desired sort order
				db.insert(tableName("notes"), { text: thirdText }),
				db.insert(tableName("notes"), { text: secondText }),
				db.insert(tableName("notes"), { text: firstText }),
			]),
		);

		const notes = yield* c.query(
			api.basic_schema_operations.orderDescCollect,
			{},
		);

		expect(notes.length).toEqual(3);
		expect(Array.map(notes, ({ text }) => text)).toStrictEqual([
			firstText,
			secondText,
			thirdText,
		]);
	}));

test("take", () =>
	Effect.gen(function* () {
		const c = yield* TestConvexService;

		yield* c.run(({ db }) =>
			Promise.all(
				Array.map(Array.range(1, 5), (n) =>
					db.insert(tableName("notes"), { text: `Note ${n}` }),
				),
			),
		);

		const oneNote = yield* c.query(api.basic_schema_operations.take, {
			n: 1,
		});
		const twoNotes = yield* c.query(api.basic_schema_operations.take, {
			n: 2,
		});
		const threeNotes = yield* c.query(api.basic_schema_operations.take, {
			n: 3,
		});

		expect(oneNote.length).toEqual(1);
		expect(twoNotes.length).toEqual(2);
		expect(threeNotes.length).toEqual(3);
	}));

test("paginate", () =>
	Effect.gen(function* () {
		const c = yield* TestConvexService;

		yield* c.run(({ db }) =>
			Promise.all(
				Array.map(Array.range(1, 9), (n) =>
					db.insert(tableName("notes"), { text: `Note ${n}` }),
				),
			),
		);

		const paginationResult = yield* c.query(
			api.basic_schema_operations.paginate,
			{
				cursor: null,
				numItems: 5,
			},
		);

		expect(paginationResult.page.length).toEqual(5);
		expect(paginationResult.isDone).toEqual(false);

		const paginationResult2 = yield* c.query(
			api.basic_schema_operations.paginate,
			{
				cursor: paginationResult.continueCursor,
				numItems: 5,
			},
		);

		expect(paginationResult2.page.length).toEqual(4);
		expect(paginationResult2.isDone).toEqual(true);
	}));

describe("unique", () => {
	test("when one note exists", () =>
		Effect.gen(function* () {
			const c = yield* TestConvexService;

			yield* c.run(({ db }) =>
				db.insert(tableName("notes"), { text: "Hello, world!" }),
			);

			const note = yield* c.query(api.basic_schema_operations.unique, {});

			expect(note).toMatchObject({ text: "Hello, world!" });
		}));

	test("when more than two notes exist", () =>
		Effect.gen(function* () {
			const c = yield* TestConvexService;

			const text = "Hello, world!";

			yield* c.run(({ db }) =>
				Promise.all([
					db.insert(tableName("notes"), { text }),
					db.insert(tableName("notes"), { text }),
				]),
			);

			const note = yield* c.query(api.basic_schema_operations.unique, {});

			expect(note).toEqual(new NotUniqueError()._tag);
		}));

	test("when zero notes exist", () =>
		Effect.gen(function* () {
			const c = yield* TestConvexService;

			const note = yield* c.query(api.basic_schema_operations.unique, {});

			expect(note).toEqual(null);
		}));
});

describe("only first", () => {
	test("when one note exists", () =>
		Effect.gen(function* () {
			const c = yield* TestConvexService;

			const text = "Hello, world!";

			yield* c.run(({ db }) => db.insert(tableName("notes"), { text }));

			const note = yield* c.query(api.basic_schema_operations.onlyFirst, {});

			expect(note?.text).toEqual(text);
		}));

	test("when zero notes exist", () =>
		Effect.gen(function* () {
			const c = yield* TestConvexService;

			const note = yield* c.query(api.basic_schema_operations.onlyFirst, {});

			expect(note).toEqual(null);
		}));
});

test("mapTextStream", () =>
	Effect.gen(function* () {
		const c = yield* TestConvexService;

		const notesText = ["Note 1", "Note 2"];

		yield* c.run(({ db }) =>
			Promise.all(
				Array.map(notesText, (text) => db.insert(tableName("notes"), { text })),
			),
		);

		const notes = yield* c.query(api.basic_schema_operations.mapTextStream, {});

		expect(notes).toEqual(notesText);
	}));

test("search", () =>
	Effect.gen(function* () {
		const c = yield* TestConvexService;

		const text = "Hello, world!";

		yield* c.run(({ db }) =>
			Promise.all([
				db.insert(tableName("notes"), {
					text,
					tag: "greeting",
				}),
				db.insert(tableName("notes"), {
					text: "Mexican burrito recipe",
					tag: "recipe",
				}),
			]),
		);

		const notes = yield* c.query(api.basic_schema_operations.search, {
			query: "Hello",
			tag: "greeting",
		});

		expect(notes.length).toEqual(1);
		expect(notes[0]).toEqual(text);
	}));

test("queryNormalizeId", () =>
	Effect.gen(function* () {
		const c = yield* TestConvexService;

		const noteId = yield* c.run(({ db }) =>
			db.insert(tableName("notes"), { text: "Hello world!" }),
		);

		const exit = yield* c
			.query(api.basic_schema_operations.queryNormalizeId, {
				noteId,
			})
			.pipe(Effect.exit);

		expect(Exit.isSuccess(exit)).toBe(true);
	}));

test("mutationNormalizeId", () =>
	Effect.gen(function* () {
		const c = yield* TestConvexService;

		const noteId = yield* c.run(({ db }) =>
			db.insert(tableName("notes"), { text: "Hello world!" }),
		);

		const exit = yield* c
			.mutation(api.basic_schema_operations.mutationNormalizeId, {
				noteId,
			})
			.pipe(Effect.exit);

		expect(Exit.isSuccess(exit)).toBe(true);
	}));

test("patch", () =>
	Effect.gen(function* () {
		const c = yield* TestConvexService;

		const originalText = "Hello, Mars!";

		const noteId = yield* c.run(({ db }) =>
			db.insert(tableName("notes"), { text: originalText }),
		);

		const originalNote = yield* c.run(({ db }) => db.get(noteId));

		expect(originalNote?.text).toEqual(originalText);

		const updatedText = "Hello, world!";

		yield* c.mutation(api.basic_schema_operations.patch, {
			noteId,
			fields: { text: updatedText },
		});

		const updatedNote = yield* c.run(({ db }) => db.get(noteId));

		expect(updatedNote?.text).toEqual(updatedText);
	}));

test("insertTooLongText", () =>
	Effect.gen(function* () {
		const c = yield* TestConvexService;

		const tooLongText = String.repeat(101)("a");

		const exit = yield* c
			.mutation(api.basic_schema_operations.insertTooLongText, {
				text: tooLongText,
			})
			.pipe(Effect.exit);

		expect(Exit.isFailure(exit)).toBe(true);
	}));

describe("patch", () => {
	test("invalid patch", () =>
		Effect.gen(function* () {
			const c = yield* TestConvexService;

			const noteId = yield* c.run(({ db }) =>
				db.insert(tableName("notes"), { text: "Hello, world!" }),
			);

			const tooLongText = String.repeat(101)("a");

			const exit = yield* c
				.mutation(api.basic_schema_operations.patch, {
					noteId,
					fields: {
						text: tooLongText,
					},
				})
				.pipe(Effect.exit);

			// TODO: Check for exact failure, here and everywhere else `Exit.isFailure` is used
			expect(Exit.isFailure(exit)).toBe(true);
		}));

	test("valid patch", () =>
		Effect.gen(function* () {
			const c = yield* TestConvexService;

			const noteId = yield* c.run(({ db }) =>
				db.insert(tableName("notes"), { text: "Hello, world!" }),
			);

			const author = { role: "user", name: "Joe" } as const;

			yield* c.mutation(api.basic_schema_operations.patch, {
				noteId,
				fields: { author },
			});

			const patchedNote = yield* c.run(({ db }) => db.get(noteId));

			expect(patchedNote?.author).toMatchObject(author);
		}));
});
