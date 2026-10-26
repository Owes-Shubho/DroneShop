export const notFound = (req, res) => {
  res.status(404).json({ message: `Not found: ${req.originalUrl}` });
};

export const errorHandler = (err, req, res, next) => {
  let status = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  if (err.name === 'ValidationError') status = 400;
  if (err.name === 'CastError') status = 404;
  res.status(status).json({ message: err.message });
};
