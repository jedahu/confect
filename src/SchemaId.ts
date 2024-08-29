import { AST, Schema } from "@effect/schema";
import type { GenericId } from "convex/values";

export const ConvexTableName = Symbol.for("confect/schema/ConvexTableName");

export const SchemaId = <TableName extends string>(
	name: TableName,
): Schema.Schema<GenericId<TableName>> =>
	Schema.make(
		AST.annotations(Schema.String.ast, { [ConvexTableName]: name }),
	) as unknown as Schema.Schema<GenericId<TableName>>;

export type SchemaId<TableName extends string> = Schema.Schema.Type<
	typeof SchemaId<TableName>
>;
