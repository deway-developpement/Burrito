"use strict";
// configuration.ts
exports.__esModule = true;
exports.configuration = void 0;
var configuration = function () { return ({
    jwt: {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.JWT_EXPIRES_IN,
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN
    },
    database: {
        username: process.env.DATABASE_USERNAME,
        password: process.env.DATABASE_PASSWORD
    }
}); };
exports.configuration = configuration;
