import { CustomScalar, Scalar } from '@nestjs/graphql';
import { Kind, ValueNode } from 'graphql';

@Scalar('JSON')
export class JsonScalar implements CustomScalar<unknown, unknown> {
  description = 'JSON custom scalar';

  parseValue(value: unknown): unknown {
    return value;
  }

  serialize(value: unknown): unknown {
    return value;
  }

  parseLiteral(ast: ValueNode): unknown {
    switch (ast.kind) {
      case Kind.STRING:
      case Kind.BOOLEAN:
        return ast.value;
      case Kind.INT:
      case Kind.FLOAT:
        return Number(ast.value);
      case Kind.NULL:
        return null;
      case Kind.LIST:
        return ast.values.map((value) => this.parseLiteral(value));
      case Kind.OBJECT: {
        const value: Record<string, unknown> = {};
        for (const field of ast.fields) {
          value[field.name.value] = this.parseLiteral(field.value);
        }
        return value;
      }
      default:
        return null;
    }
  }
}
