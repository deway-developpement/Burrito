import { Model } from 'mongoose';

type CountCompatibleModel = typeof Model & {
  __countCompatPatched?: boolean;
};

/**
 * NestJS Query still calls `Model.count`, but Mongoose 8 removed it.
 * Re-add a compatible alias so existing query services keep working.
 */
export function patchMongooseCountCompatibility(): void {
  const modelCtor = Model as CountCompatibleModel;

  if (modelCtor.__countCompatPatched) {
    return;
  }

  const anyModelCtor = modelCtor as unknown as {
    count?: (...args: unknown[]) => unknown;
    __countCompatPatched?: boolean;
  };

  if (typeof anyModelCtor.count !== 'function') {
    anyModelCtor.count = function countCompat(
      this: { countDocuments: (...args: unknown[]) => unknown },
      ...args: unknown[]
    ) {
      return this.countDocuments(...args);
    };
  }

  modelCtor.__countCompatPatched = true;
}

