//A list of functions that provide error outputs.
export const errors = {
    database: function(e: any) {
        console.warn("Database error", e);
        return ({
            type: "database_error",
            statusCode: 500,
            message: "Database error",
        });
    },
    invalid_request: function() {
        return ({
            type: "invalid",
            statusCode: 400,
            message: "Invalid parameters",
        });
    },
    no_session: function() {
        return ({
            type: "no_session",
            statusCode: 403,
            message: "Not logged in",
        })
    },
    forbidden: function() {
        return ({
            type: "forbidden",
            statusCode: 403,
            message: "Forbidden",
        });
    },
    bad_credentials: function() {
        return ({
            type: "bad_credentials",
            statusCode: 401,
            message: "Bad credentials",
        })
    },
    unactivated_account: function() {
        return ({
            type: "unactivated",
            statusCode: 403,
            message: "Activate your user account before logging in",
        });
    },
    already_exists: function(resource: string) {
        return ({
            type: "already_exists",
            statusCode: 409,
            message: resource + " already exists",
        });
    },
    not_found: function(resource: string) {
        return ({
            type: "not_found",
            statusCode: 404,
            message: resource + " not found",
        })
    },
    has_children: function() {
        return ({
            type: "has_children",
            statusCode: 409,
            message: "Resource has children",
        })
    },
    expired: function(resource: string) {
        return ({
            type: "expired",
            statusCode: 410,
            message: resource + " has expired"
        })
    }
};