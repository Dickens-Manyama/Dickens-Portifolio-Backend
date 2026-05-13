function ok(res, data) {
  return res.status(200).json(data);
}

function created(res, data) {
  return res.status(201).json(data);
}

function fail(res, status, message, details) {
  return res.status(status).json({
    message,
    ...(details ? { details } : {}),
  });
}

module.exports = { ok, created, fail };

