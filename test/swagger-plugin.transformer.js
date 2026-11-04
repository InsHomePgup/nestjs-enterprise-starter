// Applies the @nestjs/swagger CLI plugin inside ts-jest so e2e tests see the same
// OpenAPI document as `nest build` produces.
const transformer = require('@nestjs/swagger/plugin');
const options = require('../swagger-plugin.options');

module.exports.name = 'nestjs-swagger-transformer';
module.exports.version = 1;
module.exports.factory = (cs) => transformer.before(options, cs.program);
