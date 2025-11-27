"use strict";
exports.__esModule = true;
exports.validationSchema = void 0;
var Joi = require("joi");
exports.validationSchema = Joi.object({
    JWT_SECRET: Joi.string().required(),
    JWT_EXPIRES_IN: Joi.string().required()
});
