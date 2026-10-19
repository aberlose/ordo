export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} ${id} not found`);
    this.name = 'NotFoundError';
  }
}

/** A request that is well-formed but breaks a business rule (e.g. due date before start date). */
export class RuleViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuleViolationError';
  }
}

/** A request that collides with existing data (e.g. a tag name already used on the board). */
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

/**
 * Input that passed the contract's schema but that the main process still refuses to handle (e.g. a
 * pasted file that is not an image, notes nested too deep). Reported as `invalid_input`.
 */
export class InvalidInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidInputError';
  }
}
