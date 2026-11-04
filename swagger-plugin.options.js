/**
 * Options for the @nestjs/swagger CLI plugin, shared by `nest build` (nest-cli.json)
 * and the e2e Jest transformer (test/swagger-plugin.transformer.js).
 * Keep nest-cli.json's "plugins[0].options" identical to this object.
 *
 * - introspectComments: JSDoc on DTO properties -> property descriptions,
 *   JSDoc on controller methods -> operation summary (first line) / description.
 * - classValidatorShim: class-validator rules (min/max/length/format) -> schema constraints.
 * - autoFillEnumName: enums become named schemas (e.g. `Role`), so generated clients get
 *   real enum types instead of string literal unions.
 */
module.exports = {
  introspectComments: true,
  classValidatorShim: true,
  autoFillEnumName: true,
  controllerKeyOfComment: 'summary',
  dtoFileNameSuffix: ['.dto.ts'],
  controllerFileNameSuffix: ['.controller.ts'],
};
