import { HttpException, HttpStatus } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';
import { Request, Response } from 'express';
import { HttpExceptionFilter } from './http-exception.filter';
import { jsonLogger } from '../json-logger.service';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockResponse: Partial<Response>;
  let mockRequest: Partial<Request>;
  let mockArgumentsHost: Partial<ArgumentsHost>;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockRequest = {
      method: 'GET',
      url: '/test-route',
      headers: {
        'x-request-id': 'mock-request-id-123',
      },
    };
    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    };
  });

  it('should format HttpException and include requestId in the body', () => {
    const exception = new HttpException('Bad request', HttpStatus.BAD_REQUEST);

    jsonLogger.runWithContext({ requestId: 'mock-request-id-123' }, () => {
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);
    });

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        code: 'BAD_REQUEST',
        message: 'Bad request',
        statusCode: HttpStatus.BAD_REQUEST,
        requestId: 'mock-request-id-123',
      },
      requestId: 'mock-request-id-123',
    });
  });

  it('should fall back to request header if context has no requestId', () => {
    const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

    filter.catch(exception, mockArgumentsHost as ArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        code: 'FORBIDDEN',
        message: 'Forbidden',
        statusCode: HttpStatus.FORBIDDEN,
        requestId: 'mock-request-id-123',
      },
      requestId: 'mock-request-id-123',
    });
  });

  it('should handle non-HttpException (Internal Server Error)', () => {
    const exception = new Error('Database connection failed');

    // Spy on jsonLogger.error to suppress console output in test
    jest.spyOn(jsonLogger, 'error').mockImplementation(() => {});

    jsonLogger.runWithContext({ requestId: 'mock-request-id-123' }, () => {
      filter.catch(exception, mockArgumentsHost as ArgumentsHost);
    });

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        requestId: 'mock-request-id-123',
      },
      requestId: 'mock-request-id-123',
    });
  });
});
