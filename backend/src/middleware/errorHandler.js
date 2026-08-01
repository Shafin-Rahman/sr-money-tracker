export function errorHandler(err, req, res, _next) {
  console.error('Error:', err);

  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  if (err.code === '23505') {
    return res.status(409).json({
      error: 'Duplicate value',
      message: err.message,
    });
  }

  if (err.code === '23503') {
    return res.status(409).json({
      error: 'Referenced record not found',
      message: err.message,
    });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
}
