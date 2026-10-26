export class ApiError extends Error {
    statusCode: number;
    errorCode?: string;

    constructor(
        statusCode: number,
        message: string,
        errorCode?: string
    ) {
        super(message);

        this.statusCode = statusCode;
        this.errorCode = errorCode;

        this.name = "ApiError";
    }
}