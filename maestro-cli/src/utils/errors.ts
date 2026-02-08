export interface CLIError {
  success: false;
  error: string;
  message: string;
  details?: Record<string, any>;
  suggestion?: string;
}

/**
 * Exit code mapping:
 *   0 = Success
 *   1 = General / validation error
 *   2 = Resource not found
 *   3 = Network / connection error
 *   4 = Permission denied
 *   5 = Claude spawn failed
 */

export function createError(
  code: string,
  message: string,
  details?: Record<string, any>,
  suggestion?: string
): CLIError {
  return {
    success: false,
    error: code,
    message,
    details,
    suggestion
  };
}

export function handleError(err: any, json: boolean): never {
  let cliError: CLIError;
  let exitCode = 1; // default: general error

  if (err.response) {
    // HTTP error from server
    const status = err.response.status;
    const data = err.response.data || {};

    switch (status) {
      case 404:
        cliError = createError(
          'resource_not_found',
          data.message || 'Resource not found',
          { status, url: err.config?.url },
          'Use list commands to see available resources'
        );
        exitCode = 2;
        break;

      case 403:
        cliError = createError(
          'permission_denied',
          data.message || 'Permission denied',
          { status },
          'Check your access permissions'
        );
        exitCode = 4;
        break;

      case 400:
        cliError = createError(
          'invalid_request',
          data.message || 'Invalid request',
          { status, errors: data.errors },
          'Check command arguments and try again'
        );
        exitCode = 1;
        break;

      case 500:
        cliError = createError(
          'server_error',
          data.message || 'Internal server error',
          { status },
          'Check server logs or try again later'
        );
        exitCode = 1;
        break;

      default:
        cliError = createError(
          'http_error',
          data.message || `HTTP ${status} error`,
          { status }
        );
    }
  } else if (err.code === 'ECONNREFUSED') {
    // Connection refused
    cliError = createError(
      'connection_refused',
      'Cannot connect to Maestro Server',
      {
        server: err.config?.baseURL || 'http://localhost:3000',
        errno: err.code
      },
      'Is the Maestro Server running? Try: cd maestro-server && npm run dev'
    );
    exitCode = 3;
  } else if (err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') {
    // Network timeout or DNS failure
    cliError = createError(
      'network_error',
      'Network connection failed',
      { errno: err.code, server: err.config?.baseURL },
      'Check your network connection and server URL'
    );
    exitCode = 3;
  } else if (err.error === 'resource_not_found') {
    cliError = createError(
      'resource_not_found',
      err.message || 'Resource not found',
      err.details,
      err.suggestion || 'Use list commands to see available resources'
    );
    exitCode = 2;
  } else if (err.error === 'permission_denied') {
    cliError = createError(
      'permission_denied',
      err.message || 'Permission denied',
      err.details,
      err.suggestion
    );
    exitCode = 4;
  } else if (err.error === 'spawn_failed') {
    cliError = createError(
      'spawn_failed',
      err.message || 'Claude spawn failed',
      err.details,
      err.suggestion || 'Check Claude Code installation and configuration'
    );
    exitCode = 5;
  } else if (err.success === false) {
    // Already formatted as CLIError
    cliError = err;
  } else if (err.message && /not found/i.test(err.message)) {
    // Detect "not found" patterns from storage/other errors
    cliError = createError(
      'resource_not_found',
      err.message,
      {},
      'Use list commands to see available resources'
    );
    exitCode = 2;
  } else {
    // Unknown error
    cliError = createError(
      'unknown_error',
      err.message || 'An unexpected error occurred',
      { originalError: err.toString() }
    );
  }

  if (json) {
    console.log(JSON.stringify(cliError, null, 2));
  } else {
    console.error(`\nError: ${cliError.message}`);
    if (cliError.details) {
      console.error(`   Details: ${JSON.stringify(cliError.details, null, 2)}`);
    }
    if (cliError.suggestion) {
      console.error(`   ${cliError.suggestion}`);
    }
    console.error('');
  }

  process.exit(exitCode);
}

export function throwValidationError(code: string, message: string, suggestion?: string): never {
  const error: any = createError(code, message, {}, suggestion);
  error.success = false;
  throw error;
}
