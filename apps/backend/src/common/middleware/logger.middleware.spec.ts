import { NextFunction, Request, Response } from 'express';
import { LoggerMiddleware } from './logger.middleware';

describe('LoggerMiddleware', () => {
  it('returns the request id in the response header', () => {
    const middleware = new LoggerMiddleware();
    const req = {
      headers: { 'x-request-id': 'req-123' },
      method: 'GET',
      originalUrl: '/health',
    } as unknown as Request;
    const res = {
      on: jest.fn(),
      setHeader: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as NextFunction;

    middleware.use(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'req-123');
    expect(next).toHaveBeenCalledTimes(1);
  });
});
