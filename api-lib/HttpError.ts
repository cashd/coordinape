import { VercelResponse } from '@vercel/node';

export interface HttpError extends Error {
  httpStatus: number;
}

export class InternalServerError extends Error implements HttpError {
  // TODO: it seems like hasura doesn't like 500s so we should pick a 4xx as the default error
  httpStatus = 500;
}

export class PayloadTooLargeError extends Error implements HttpError {
  httpStatus = 413;
}

export class NotFoundError extends Error {
  httpStatus = 404;
}

export class ForbiddenError extends Error {
  httpStatus = 403;
}

export class BadRequestError extends Error {
  httpStatus = 400;
}

export function ErrorResponse(res: VercelResponse, error: any): VercelResponse {
  const statusCode = error.httpStatus || 500;
  return ErrorResponseWithStatusCode(res, error, statusCode);
}

export function ErrorResponseWithStatusCode(
  res: VercelResponse,
  error: any,
  statusCode: number
): VercelResponse {
  return res.status(statusCode).json({
    message: error.message || 'Unexpected error',
    // included at this level for backwards compat w/ older hasura, perhaps can remove
    code: `${statusCode}`,
    extensions: {
      code: `${statusCode}`,
    },
  });
}
