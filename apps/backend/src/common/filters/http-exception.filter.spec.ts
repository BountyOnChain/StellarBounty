import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { Request, Response } from 'express';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  it('includes the request id in error responses', () => {
    const filter = new HttpExceptionFilter();
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const request = {
      headers: { 'x-request-id': 'req-123' },
      method: 'GET',
      url: '/bad',
      originalUrl: '/bad',
    } as unknown as Request;
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as ArgumentsHost;

    filter.catch(new BadRequestException('invalid'), host);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      error: expect.objectContaining({ requestId: 'req-123' }),
    });
  });
});
