/**
 * EduBridge Adaptive - Role-Based Access Control (RBAC)
 */

const ApiResponse = require('../utils/apiResponse');

function authorize(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return ApiResponse.error(res, 401, 'User context not authenticated', 'UNAUTHORIZED');
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
      return ApiResponse.error(
        res,
        403,
        `Access denied. Requires one of roles: [${allowedRoles.join(', ')}]`,
        'FORBIDDEN'
      );
    }

    next();
  };
}

module.exports = authorize;
