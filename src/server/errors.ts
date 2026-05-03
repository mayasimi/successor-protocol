export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super(404, "not_found", `${resource} was not found`);
  }
}

export class ConflictError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(409, "conflict", message, details);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "Unauthorized") {
    super(401, "unauthorized", message);
  }
}
